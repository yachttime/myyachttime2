/*
  # Fix convert_work_order_to_invoice: search repair requests by work_order_id as fallback

  ## Problem
  When a repair request is created from a work order directly (work_order_id set but
  estimate_id is null on the repair request), the convert_work_order_to_invoice function
  could not find it because it only searched by estimate_id. This left the repair request
  unlinked and without the estimating_invoice_id set.

  ## Fix
  Add a second lookup: if no repair request is found via estimate_id, also check
  repair_requests.work_order_id = p_work_order_id.
*/

CREATE OR REPLACE FUNCTION public.convert_work_order_to_invoice(p_work_order_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
COALESCE(v_work_order.surcharge_amount, 0),
v_work_order.total_amount,
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
$function$;
