/*
# Apply work order discounts before tax when creating invoices

1. Problem
- When a work order was converted to an invoice, the discount was subtracted from the total after sales tax, shop supplies, park fees and surcharge had already been calculated on the full amount.
- The estimate editor already calculates these on the discounted amount, so the invoice total could differ from the estimate the customer approved.

2. Change to convert_work_order_to_invoice
- Discount is calculated first: discount = subtotal x discount rate.
- The discounted subtotal and a discount ratio are then used for:
  - Sales tax: taxable subtotal x discount ratio x tax rate.
  - Shop supplies: discounted subtotal x shop supplies rate.
  - Park fees: discounted subtotal x park fees rate.
  - Surcharge: surchargeable subtotal x discount ratio x surcharge rate (still capped).
- Invoice total = discounted subtotal + tax + shop supplies + park fees + capped surcharge.
- Invoice subtotal, discount percentage and discount amount are still stored so the invoice shows the full subtotal and the discount line.

3. Security
- No table, policy or grant changes. The function keeps its existing security settings.

4. Notes
- Estimate approval (approve_estimate) already produces the same total, so it is not changed.
- Invoices that already exist are not modified by this migration.
*/

CREATE OR REPLACE FUNCTION public.convert_work_order_to_invoice(p_work_order_id uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
v_surcharge_cap numeric(10,2);
v_capped_surcharge numeric(10,2);
v_discount_rate numeric(10,6);
v_discount_amount numeric(10,2);
v_discounted_subtotal numeric(10,2);
v_discount_ratio numeric(10,6);
v_capped_total numeric(10,2);
v_payments_total numeric(10,2);
v_amount_paid numeric(10,2);
v_balance_due numeric(10,2);
v_payment_status text;
v_paid_at timestamptz;
v_payment_method_type text;
v_stripe_payment_intent_id text;
v_subtotal numeric(10,2);
v_taxable_subtotal numeric(10,2);
v_surchargeable_subtotal numeric(10,2);
v_tax_amount numeric(10,2);
v_shop_supplies_amount numeric(10,2);
v_park_fees_amount numeric(10,2);
v_surcharge_amount numeric(10,2);
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

-- === Recalculate financial summary from line items ===
SELECT
COALESCE(SUM(woli.total_price), 0),
COALESCE(SUM(CASE WHEN woli.is_taxable THEN woli.total_price ELSE 0 END), 0),
COALESCE((
SELECT SUM(woli2.total_price)
FROM work_order_line_items woli2
JOIN work_order_tasks wot2 ON woli2.task_id = wot2.id
WHERE wot2.work_order_id = p_work_order_id AND wot2.apply_surcharge = true
), 0)
INTO v_subtotal, v_taxable_subtotal, v_surchargeable_subtotal
FROM work_order_line_items woli
JOIN work_order_tasks wot ON woli.task_id = wot.id
WHERE wot.work_order_id = p_work_order_id;

-- Discount is applied before tax and fees
v_discount_rate := COALESCE(v_work_order.discount, 0);
v_discount_amount := v_subtotal * v_discount_rate;
v_discounted_subtotal := v_subtotal - v_discount_amount;
v_discount_ratio := CASE WHEN v_subtotal > 0 THEN v_discounted_subtotal / v_subtotal ELSE 1 END;

-- Tax: discounted taxable subtotal * rate
v_tax_amount := ROUND(v_taxable_subtotal * v_discount_ratio * COALESCE(v_work_order.sales_tax_rate, 0), 2);

-- Shop supplies
IF COALESCE(v_work_order.shop_supplies_amount, 0) > 0 THEN
v_shop_supplies_amount := v_discounted_subtotal * COALESCE(v_work_order.shop_supplies_rate, 0);
ELSE
v_shop_supplies_amount := 0;
END IF;

-- Park fees
IF COALESCE(v_work_order.park_fees_amount, 0) > 0 THEN
v_park_fees_amount := v_discounted_subtotal * COALESCE(v_work_order.park_fees_rate, 0);
ELSE
v_park_fees_amount := 0;
END IF;

-- Surcharge (capped)
v_surcharge_amount := v_surchargeable_subtotal * v_discount_ratio * COALESCE(v_work_order.surcharge_rate, 0);
SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;
v_capped_surcharge := CASE
WHEN v_surcharge_cap IS NOT NULL AND v_surcharge_amount > v_surcharge_cap
THEN v_surcharge_cap
ELSE v_surcharge_amount
END;

v_capped_total := v_discounted_subtotal
+ v_tax_amount
+ v_shop_supplies_amount
+ v_park_fees_amount
+ v_capped_surcharge;

-- === Determine deposit to apply ===
v_deposit_applied := 0;
IF v_work_order.deposit_required = true
AND v_work_order.deposit_payment_status = 'paid'
AND v_work_order.deposit_amount IS NOT NULL THEN
v_deposit_applied := v_work_order.deposit_amount;
END IF;

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

-- === Check prior payments in estimating_payments ===
SELECT
COALESCE(SUM(ep.amount), 0),
MAX(ep.payment_date),
MAX(ep.payment_method_type),
MAX(ep.stripe_payment_intent_id)
INTO v_payments_total, v_paid_at, v_payment_method_type, v_stripe_payment_intent_id
FROM estimating_payments ep
WHERE ep.work_order_id = p_work_order_id;

-- amount_paid = total cash received (deposit + any payments from estimating_payments)
-- If the deposit was paid via Stripe, it's already in estimating_payments.
-- If it came from a repair_request (not in estimating_payments), add it.
v_amount_paid := v_payments_total + v_deposit_applied;

-- Balance = total - all cash received
v_balance_due := GREATEST(0, v_capped_total - v_amount_paid);

IF v_balance_due <= 0 THEN
v_payment_status := 'paid';
ELSIF v_amount_paid > 0 THEN
v_payment_status := 'partial';
ELSE
v_payment_status := 'unpaid';
v_paid_at := NULL;
END IF;

v_invoice_number := generate_estimating_invoice_number();

INSERT INTO estimating_invoices (
invoice_number, work_order_id, estimate_id, yacht_id,
customer_name, customer_email, customer_phone, is_retail_customer,
invoice_date, due_date,
subtotal, tax_rate, tax_amount,
shop_supplies_amount, park_fees_amount, surcharge_amount,
discount_percentage, discount_amount,
total_amount, balance_due, deposit_applied,
payment_status, amount_paid,
final_payment_paid_at, final_payment_method_type, final_payment_stripe_payment_intent_id,
notes, created_by, company_id
) VALUES (
v_invoice_number, p_work_order_id, v_work_order.estimate_id, v_work_order.yacht_id,
v_customer_name, v_work_order.customer_email, v_work_order.customer_phone, v_work_order.is_retail_customer,
CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
v_subtotal, COALESCE(v_work_order.sales_tax_rate, 0), v_tax_amount,
v_shop_supplies_amount, v_park_fees_amount, v_capped_surcharge,
v_discount_rate * 100, v_discount_amount,
v_capped_total, v_balance_due, v_deposit_applied,
v_payment_status, v_amount_paid,
CASE WHEN v_payment_status = 'paid' THEN v_paid_at ELSE NULL END,
CASE WHEN v_payment_status = 'paid' THEN v_payment_method_type ELSE NULL END,
CASE WHEN v_payment_status = 'paid' THEN v_stripe_payment_intent_id ELSE NULL END,
v_work_order.notes, p_user_id, v_work_order.company_id
) RETURNING id INTO v_invoice_id;

-- Re-point any orphaned estimating_payments rows to the new invoice
UPDATE estimating_payments
SET invoice_id = v_invoice_id, updated_at = now()
WHERE work_order_id = p_work_order_id
AND invoice_id IS NULL;

-- === Copy line items ===
v_line_order := 1;
FOR v_line_item IN
SELECT
wot.task_name, woli.line_type, woli.description, woli.quantity,
woli.unit_price, woli.total_price, woli.is_taxable,
woli.labor_code_id, woli.part_id, woli.work_details
FROM work_order_line_items woli
JOIN work_order_tasks wot ON woli.task_id = wot.id
WHERE wot.work_order_id = p_work_order_id
ORDER BY wot.task_order, woli.line_order
LOOP
INSERT INTO estimating_invoice_line_items (
invoice_id, task_name, line_type, description, quantity, unit_price,
total_price, is_taxable, labor_code_id, part_id, line_order, work_details
) VALUES (
v_invoice_id, v_line_item.task_name, v_line_item.line_type, v_line_item.description,
v_line_item.quantity, v_line_item.unit_price, v_line_item.total_price,
v_line_item.is_taxable, v_line_item.labor_code_id, v_line_item.part_id,
v_line_order, v_line_item.work_details
);
v_line_order := v_line_order + 1;
END LOOP;

-- === Link invoice back to repair request ===
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
SET estimating_invoice_id = v_invoice_id, status = 'completed', updated_at = now()
WHERE id = v_repair_request_id AND estimating_invoice_id IS NULL;
END IF;

RETURN v_invoice_id;
END;
$function$;
