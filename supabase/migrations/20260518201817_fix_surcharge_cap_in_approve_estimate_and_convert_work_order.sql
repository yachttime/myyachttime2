/*
  # Fix surcharge cap enforcement in approve_estimate and convert_work_order_to_invoice

  ## Problem
  Both functions copy surcharge_amount directly from the source record without
  applying the surcharge_cap from estimate_settings. This caused INV000055 to
  show $15,259.15 instead of the capped $7,500.00.

  ## Changes
  1. approve_estimate: Read surcharge_cap from estimate_settings, apply cap when
     copying surcharge_amount to the new work order.
  2. convert_work_order_to_invoice: Read surcharge_cap from estimate_settings,
     apply cap when copying surcharge_amount to the new invoice and recalculate total.

  Both functions now use: LEAST(surcharge_amount, surcharge_cap) when a cap exists.
*/

-- Fix approve_estimate to apply surcharge cap when creating work order
CREATE OR REPLACE FUNCTION approve_estimate(p_estimate_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
v_estimate record;
v_work_order_id uuid;
v_work_order_number text;
v_next_number integer;
v_inventory_result jsonb;
v_line_item record;
v_vendor_name text;
v_vendor_id uuid;
v_vendor_contact text;
v_vendor_email text;
v_vendor_phone text;
v_vendor_address text;
v_vendor_city text;
v_vendor_state text;
v_vendor_zip text;
v_vendor_source text;
v_po_id uuid;
v_po_number text;
v_next_po_number integer;
v_part_number text;
v_yacht_name text;
v_company_id uuid;
v_repair_request record;
v_surcharge_cap numeric(10,2);
v_capped_surcharge numeric(10,2);
v_capped_total numeric(10,2);
BEGIN
IF NOT EXISTS (
SELECT 1 FROM user_profiles
WHERE user_id = p_user_id
AND is_active = true
AND (
role IN ('staff', 'mechanic', 'master')
OR (role = 'manager' AND can_approve_repairs = true)
)
) THEN
RAISE EXCEPTION 'You do not have permission to approve estimates';
END IF;

SELECT * INTO v_estimate FROM estimates WHERE id = p_estimate_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Estimate not found';
END IF;

IF v_estimate.status NOT IN ('draft', 'sent') THEN
RAISE EXCEPTION 'Estimate cannot be approved. Current status: %', v_estimate.status;
END IF;

v_company_id := v_estimate.company_id;

IF v_estimate.yacht_id IS NOT NULL THEN
SELECT name INTO v_yacht_name FROM yachts WHERE id = v_estimate.yacht_id;
END IF;

-- Read surcharge cap from settings and apply it
SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;
v_capped_surcharge := CASE
  WHEN v_surcharge_cap IS NOT NULL AND v_estimate.surcharge_amount > v_surcharge_cap
  THEN v_surcharge_cap
  ELSE v_estimate.surcharge_amount
END;
v_capped_total := v_estimate.subtotal
  + v_estimate.sales_tax_amount
  + COALESCE(v_estimate.shop_supplies_amount, 0)
  + COALESCE(v_estimate.park_fees_amount, 0)
  + COALESCE(v_capped_surcharge, 0);

UPDATE estimates
SET status = 'approved', approved_by = p_user_id, approved_at = now(), updated_at = now()
WHERE id = p_estimate_id;

SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 3) AS INTEGER)), 0) + 1
INTO v_next_number FROM work_orders;
v_work_order_number := 'WO' || LPAD(v_next_number::text, 6, '0');

INSERT INTO work_orders (
work_order_number, estimate_id, yacht_id, vessel_id, customer_name, customer_email, customer_phone,
is_retail_customer, status, total_hours_worked, subtotal, sales_tax_rate, sales_tax_amount,
shop_supplies_rate, shop_supplies_amount, park_fees_rate, park_fees_amount,
surcharge_rate, surcharge_amount, total_amount, notes, customer_notes, work_title, company_id, created_by
) VALUES (
v_work_order_number, p_estimate_id, v_estimate.yacht_id, v_estimate.customer_vessel_id,
v_estimate.customer_name, v_estimate.customer_email, v_estimate.customer_phone,
v_estimate.is_retail_customer, 'pending', 0,
v_estimate.subtotal, v_estimate.sales_tax_rate, v_estimate.sales_tax_amount,
v_estimate.shop_supplies_rate, v_estimate.shop_supplies_amount,
v_estimate.park_fees_rate, v_estimate.park_fees_amount,
v_estimate.surcharge_rate, v_capped_surcharge,
v_capped_total, v_estimate.notes, v_estimate.customer_notes, v_estimate.work_title, v_company_id, p_user_id
)
RETURNING id INTO v_work_order_id;

-- Check if a repair request is linked to this estimate with a paid deposit
-- and carry that deposit over to the work order
SELECT * INTO v_repair_request
FROM repair_requests
WHERE estimate_id = p_estimate_id
ORDER BY
CASE WHEN deposit_payment_status = 'paid' THEN 0 ELSE 1 END,
deposit_paid_at DESC NULLS LAST
LIMIT 1;

IF FOUND THEN
-- Link repair request to work order
UPDATE repair_requests
SET work_order_id = v_work_order_id, updated_at = now()
WHERE id = v_repair_request.id AND work_order_id IS NULL;

-- Carry paid deposit to work order if it was already paid
IF v_repair_request.deposit_payment_status = 'paid' AND v_repair_request.deposit_amount IS NOT NULL THEN
UPDATE work_orders
SET
deposit_required = true,
deposit_amount = v_repair_request.deposit_amount,
deposit_payment_status = 'paid',
deposit_paid_at = v_repair_request.deposit_paid_at,
deposit_payment_method_type = v_repair_request.deposit_payment_method_type
WHERE id = v_work_order_id;

-- Also update the new estimate deposit sync columns
UPDATE estimates
SET
repair_request_deposit_status = 'paid',
repair_request_deposit_amount = v_repair_request.deposit_amount,
repair_request_deposit_paid_at = v_repair_request.deposit_paid_at,
repair_request_deposit_method = v_repair_request.deposit_payment_method_type,
updated_at = now()
WHERE id = p_estimate_id
AND (repair_request_deposit_status IS NULL OR repair_request_deposit_status != 'paid');
END IF;
END IF;

INSERT INTO work_order_tasks (work_order_id, task_name, task_overview, task_order, apply_surcharge, is_completed, company_id)
SELECT v_work_order_id, task_name, task_overview, task_order, apply_surcharge, false, v_company_id
FROM estimate_tasks WHERE estimate_id = p_estimate_id;

INSERT INTO work_order_line_items (
work_order_id, task_id, line_type, description, quantity, unit_price, total_price,
is_taxable, labor_code_id, part_id, line_order, work_details, package_header, company_id
)
SELECT
v_work_order_id, wot.id, eli.line_type, eli.description, eli.quantity,
eli.unit_price, eli.total_price, eli.is_taxable, eli.labor_code_id,
eli.part_id, eli.line_order, eli.work_details, eli.package_header, v_company_id
FROM estimate_line_items eli
JOIN estimate_tasks et ON eli.task_id = et.id
JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id
AND wot.task_name = et.task_name AND wot.task_order = et.task_order
WHERE et.estimate_id = p_estimate_id;

SELECT process_estimate_inventory_deduction(p_estimate_id, p_user_id) INTO v_inventory_result;

FOR v_line_item IN
SELECT
eli.id AS estimate_line_item_id,
eli.description,
eli.quantity,
eli.unit_price,
eli.total_price,
eli.part_source,
eli.part_id,
eli.mercury_part_id,
eli.marine_wholesale_part_id,
eli.line_order,
woli.id AS work_order_line_item_id
FROM estimate_line_items eli
JOIN estimate_tasks et ON eli.task_id = et.id
JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id
AND wot.task_name = et.task_name AND wot.task_order = et.task_order
LEFT JOIN work_order_line_items woli ON woli.work_order_id = v_work_order_id
AND woli.task_id = wot.id
AND woli.description = eli.description
AND woli.line_order = eli.line_order
WHERE et.estimate_id = p_estimate_id
AND eli.line_type = 'part'
LOOP
v_vendor_id := NULL;
v_vendor_name := NULL;
v_vendor_contact := NULL;
v_vendor_email := NULL;
v_vendor_phone := NULL;
v_vendor_address := NULL;
v_vendor_city := NULL;
v_vendor_state := NULL;
v_vendor_zip := NULL;
v_vendor_source := 'custom';
v_part_number := NULL;

IF v_line_item.part_source = 'inventory' AND v_line_item.part_id IS NOT NULL THEN
SELECT
pi.part_number, v.id, v.vendor_name, v.contact_name,
v.email, v.phone, v.address, v.city, v.state, v.zip
INTO
v_part_number, v_vendor_id, v_vendor_name, v_vendor_contact,
v_vendor_email, v_vendor_phone, v_vendor_address, v_vendor_city, v_vendor_state, v_vendor_zip
FROM parts_inventory pi
LEFT JOIN vendors v ON pi.vendor_id = v.id
WHERE pi.id = v_line_item.part_id;

IF v_vendor_name IS NULL THEN CONTINUE; END IF;
v_vendor_source := 'vendor';

ELSIF v_line_item.part_source = 'mercury' AND v_line_item.mercury_part_id IS NOT NULL THEN
SELECT part_number INTO v_part_number FROM mercury_marine_parts WHERE id = v_line_item.mercury_part_id;
v_vendor_name := 'Mercury Marine';
v_vendor_source := 'mercury';

ELSIF v_line_item.part_source = 'marine_wholesale' AND v_line_item.marine_wholesale_part_id IS NOT NULL THEN
SELECT sku INTO v_part_number FROM marine_wholesale_parts WHERE id = v_line_item.marine_wholesale_part_id;
v_vendor_name := 'Marine Wholesale';
v_vendor_source := 'marine_wholesale';

ELSE
CONTINUE;
END IF;

SELECT id INTO v_po_id
FROM purchase_orders
WHERE work_order_id = v_work_order_id AND vendor_name = v_vendor_name
LIMIT 1;

IF v_po_id IS NULL THEN
SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 3) AS INTEGER)), 0) + 1
INTO v_next_po_number FROM purchase_orders;
v_po_number := 'PO' || LPAD(v_next_po_number::text, 6, '0');

INSERT INTO purchase_orders (
po_number, work_order_id, work_order_number,
customer_name, customer_email, customer_phone, yacht_name,
vendor_id, vendor_name, vendor_contact_name,
vendor_email, vendor_phone, vendor_address, vendor_city, vendor_state, vendor_zip,
vendor_source, status, total_cost, company_id, created_by
) VALUES (
v_po_number, v_work_order_id, v_work_order_number,
v_estimate.customer_name, v_estimate.customer_email, v_estimate.customer_phone, v_yacht_name,
v_vendor_id, v_vendor_name, v_vendor_contact,
v_vendor_email, v_vendor_phone, v_vendor_address, v_vendor_city, v_vendor_state, v_vendor_zip,
v_vendor_source, 'pending', 0, v_company_id, p_user_id
)
RETURNING id INTO v_po_id;
END IF;

INSERT INTO purchase_order_line_items (
purchase_order_id, work_order_line_item_id, part_number, description,
quantity, unit_cost, total_cost, part_source, part_id,
mercury_part_id, marine_wholesale_part_id, line_order
) VALUES (
v_po_id, v_line_item.work_order_line_item_id, v_part_number, v_line_item.description,
v_line_item.quantity, v_line_item.unit_price, v_line_item.total_price,
v_line_item.part_source, v_line_item.part_id,
v_line_item.mercury_part_id, v_line_item.marine_wholesale_part_id, v_line_item.line_order
);

UPDATE purchase_orders
SET total_cost = total_cost + v_line_item.total_price, updated_at = now()
WHERE id = v_po_id;

END LOOP;

UPDATE estimates SET status = 'converted', updated_at = now() WHERE id = p_estimate_id;

RETURN jsonb_build_object(
'success', true,
'work_order_id', v_work_order_id,
'work_order_number', v_work_order_number,
'low_stock_alerts', COALESCE(v_inventory_result->'low_stock_alerts', '[]'::jsonb)
);
END;
$$;


-- Fix convert_work_order_to_invoice to apply surcharge cap when creating invoice
CREATE OR REPLACE FUNCTION convert_work_order_to_invoice(p_work_order_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
v_work_order record;
v_invoice_id uuid;
v_invoice_number text;
v_line_item record;
v_line_order integer;
v_customer_name text;
v_yacht_name text;
v_repair_request_id uuid;
v_deposit_applied numeric(10,2);
v_repair_request record;
v_surcharge_cap numeric(10,2);
v_capped_surcharge numeric(10,2);
v_capped_total numeric(10,2);
BEGIN
SELECT wo.*, y.name as yacht_name
INTO v_work_order
FROM work_orders wo
LEFT JOIN yachts y ON y.id = wo.yacht_id
WHERE wo.id = p_work_order_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Work order not found';
END IF;

IF v_work_order.status != 'completed' THEN
RAISE EXCEPTION 'Work order must be completed before converting to invoice';
END IF;

IF EXISTS (SELECT 1 FROM estimating_invoices WHERE work_order_id = p_work_order_id) THEN
RAISE EXCEPTION 'Invoice already exists for this work order';
END IF;

IF v_work_order.customer_name IS NOT NULL AND v_work_order.customer_name != '' THEN
v_customer_name := v_work_order.customer_name;
ELSIF v_work_order.yacht_name IS NOT NULL AND v_work_order.yacht_name != '' THEN
v_customer_name := v_work_order.yacht_name;
ELSIF v_work_order.is_retail_customer THEN
v_customer_name := 'Retail Customer';
ELSE
v_customer_name := 'Customer';
END IF;

-- Determine deposit to apply
-- Priority 1: work order has its own paid deposit
v_deposit_applied := 0;
IF v_work_order.deposit_required = true
AND v_work_order.deposit_payment_status = 'paid'
AND v_work_order.deposit_amount IS NOT NULL THEN
v_deposit_applied := v_work_order.deposit_amount;
END IF;

-- Priority 2: work order came from an estimate linked to a repair request with paid deposit
IF v_deposit_applied = 0 AND v_work_order.estimate_id IS NOT NULL THEN
SELECT * INTO v_repair_request
FROM repair_requests
WHERE estimate_id = v_work_order.estimate_id
AND deposit_payment_status = 'paid'
AND deposit_amount IS NOT NULL
ORDER BY deposit_paid_at DESC
LIMIT 1;

IF FOUND THEN
v_deposit_applied := v_repair_request.deposit_amount;
END IF;
END IF;

-- Priority 3: repair request linked directly via work_order_id with paid deposit
IF v_deposit_applied = 0 THEN
SELECT * INTO v_repair_request
FROM repair_requests
WHERE work_order_id = p_work_order_id
AND deposit_payment_status = 'paid'
AND deposit_amount IS NOT NULL
ORDER BY deposit_paid_at DESC
LIMIT 1;

IF FOUND THEN
v_deposit_applied := v_repair_request.deposit_amount;
END IF;
END IF;

-- Apply surcharge cap from settings
SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;
v_capped_surcharge := CASE
  WHEN v_surcharge_cap IS NOT NULL AND COALESCE(v_work_order.surcharge_amount, 0) > v_surcharge_cap
  THEN v_surcharge_cap
  ELSE COALESCE(v_work_order.surcharge_amount, 0)
END;
v_capped_total := v_work_order.subtotal
  + v_work_order.sales_tax_amount
  + COALESCE(v_work_order.shop_supplies_amount, 0)
  + COALESCE(v_work_order.park_fees_amount, 0)
  + v_capped_surcharge;

v_invoice_number := generate_estimating_invoice_number();

INSERT INTO estimating_invoices (
invoice_number,
work_order_id,
estimate_id,
yacht_id,
customer_name,
customer_email,
customer_phone,
is_retail_customer,
invoice_date,
due_date,
subtotal,
tax_rate,
tax_amount,
shop_supplies_amount,
park_fees_amount,
surcharge_amount,
total_amount,
balance_due,
deposit_applied,
notes,
created_by
) VALUES (
v_invoice_number,
p_work_order_id,
v_work_order.estimate_id,
v_work_order.yacht_id,
v_customer_name,
v_work_order.customer_email,
v_work_order.customer_phone,
v_work_order.is_retail_customer,
CURRENT_DATE,
CURRENT_DATE + INTERVAL '30 days',
v_work_order.subtotal,
v_work_order.sales_tax_rate,
v_work_order.sales_tax_amount,
COALESCE(v_work_order.shop_supplies_amount, 0),
COALESCE(v_work_order.park_fees_amount, 0),
v_capped_surcharge,
v_capped_total,
v_capped_total - v_deposit_applied,
v_deposit_applied,
v_work_order.notes,
p_user_id
) RETURNING id INTO v_invoice_id;

v_line_order := 1;
FOR v_line_item IN
SELECT
wot.task_name,
woli.line_type,
woli.description,
woli.quantity,
woli.unit_price,
woli.total_price,
woli.is_taxable,
woli.labor_code_id,
woli.part_id,
woli.work_details
FROM work_order_line_items woli
JOIN work_order_tasks wot ON woli.task_id = wot.id
WHERE wot.work_order_id = p_work_order_id
ORDER BY wot.task_order, woli.line_order
LOOP
INSERT INTO estimating_invoice_line_items (
invoice_id,
task_name,
line_type,
description,
quantity,
unit_price,
total_price,
is_taxable,
labor_code_id,
part_id,
line_order,
work_details
) VALUES (
v_invoice_id,
v_line_item.task_name,
v_line_item.line_type,
v_line_item.description,
v_line_item.quantity,
v_line_item.unit_price,
v_line_item.total_price,
v_line_item.is_taxable,
v_line_item.labor_code_id,
v_line_item.part_id,
v_line_order,
v_line_item.work_details
);

v_line_order := v_line_order + 1;
END LOOP;

-- Link invoice back to repair request
-- First try via estimate_id, then fall back to work_order_id
IF v_work_order.estimate_id IS NOT NULL THEN
SELECT id INTO v_repair_request_id
FROM repair_requests
WHERE estimate_id = v_work_order.estimate_id
LIMIT 1;
END IF;

IF v_repair_request_id IS NULL THEN
SELECT id INTO v_repair_request_id
FROM repair_requests
WHERE work_order_id = p_work_order_id
LIMIT 1;
END IF;

IF v_repair_request_id IS NOT NULL THEN
UPDATE repair_requests
SET
estimating_invoice_id = v_invoice_id,
status = 'completed',
updated_at = now()
WHERE id = v_repair_request_id
AND estimating_invoice_id IS NULL;
END IF;

RETURN v_invoice_id;
END;
$$;
