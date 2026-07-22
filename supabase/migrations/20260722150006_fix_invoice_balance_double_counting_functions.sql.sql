/*
# Fix invoice balance double-counting of deposits

## Problem
When a work order with a paid deposit is converted to an invoice, the deposit
is counted TWICE in the balance calculation:
1. As `deposit_applied` (from the work order's deposit fields)
2. As `amount_paid` (from the estimating_payments sum, which includes the deposit row)

This produces a negative balance_due (shown as an "overpayment") and incorrectly
marks the invoice as paid.

## Changes

### 1. Fix `calculate_invoice_balance` trigger function
- Wrap the balance calculation in `GREATEST(0, ...)` so negative balances can never
  be stored, even if deposit_applied + amount_paid exceeds total_amount.

### 2. Fix `convert_work_order_to_invoice` (2-arg version: p_work_order_id, p_user_id)
- When summing estimating_payments for `v_total_paid`, EXCLUDE rows where
  `payment_type = 'deposit'` — those are already captured in `deposit_applied`.

## Important Notes
1. The trigger fix is a safety net preventing negative balances from being stored.
2. The function fix is the root cause fix — it prevents double-counting at the source.
3. Data fixes for affected invoices will be applied in a separate migration.
*/

-- 1. Fix the trigger to never store negative balances
CREATE OR REPLACE FUNCTION public.calculate_invoice_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.balance_due := GREATEST(0, NEW.total_amount - NEW.deposit_applied - NEW.amount_paid);
  RETURN NEW;
END;
$function$;

-- 2. Fix the 2-arg convert function to exclude deposit payments from amount_paid sum
CREATE OR REPLACE FUNCTION public.convert_work_order_to_invoice(p_work_order_id uuid, p_user_id uuid)
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
  v_discount_rate numeric(10,6);
  v_discount_amount numeric(10,2);
  v_capped_total numeric(10,2);
  v_total_paid numeric(10,2);
  v_balance_due numeric(10,2);
  v_payment_status text;
  v_paid_at timestamptz;
  v_payment_method_type text;
  v_stripe_payment_intent_id text;
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

  -- Calculate discount (rate stored as decimal, e.g. 0.25 = 25%)
  v_discount_rate := COALESCE(v_work_order.discount, 0);
  v_discount_amount := COALESCE(v_work_order.subtotal, 0) * v_discount_rate;

  v_capped_total := v_work_order.subtotal
    + v_work_order.sales_tax_amount
    + COALESCE(v_work_order.shop_supplies_amount, 0)
    + COALESCE(v_work_order.park_fees_amount, 0)
    + v_capped_surcharge
    - v_discount_amount;

  -- Check estimating_payments for any prior NON-DEPOSIT payments against this work order
  -- Deposit-type payments are already captured in v_deposit_applied, so excluding them
  -- prevents the deposit from being double-counted.
  SELECT
    COALESCE(SUM(ep.amount), 0),
    MAX(ep.payment_date),
    MAX(ep.payment_method_type),
    MAX(ep.stripe_payment_intent_id)
  INTO v_total_paid, v_paid_at, v_payment_method_type, v_stripe_payment_intent_id
  FROM estimating_payments ep
  WHERE ep.work_order_id = p_work_order_id
    AND ep.payment_type != 'deposit';

  v_balance_due := GREATEST(0, v_capped_total - v_deposit_applied - v_total_paid);

  IF v_balance_due <= 0 THEN
    v_payment_status := 'paid';
  ELSE
    v_payment_status := 'unpaid';
    v_paid_at := NULL;
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
    discount_percentage,
    discount_amount,
    total_amount,
    balance_due,
    deposit_applied,
    payment_status,
    amount_paid,
    final_payment_paid_at,
    final_payment_method_type,
    final_payment_stripe_payment_intent_id,
    notes,
    created_by,
    trip_inspection_id
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
    v_discount_rate * 100,
    v_discount_amount,
    v_capped_total,
    v_balance_due,
    v_deposit_applied,
    v_payment_status,
    CASE WHEN v_payment_status = 'paid' THEN v_total_paid ELSE 0 END,
    CASE WHEN v_payment_status = 'paid' THEN v_paid_at ELSE NULL END,
    CASE WHEN v_payment_status = 'paid' THEN v_payment_method_type ELSE NULL END,
    CASE WHEN v_payment_status = 'paid' THEN v_stripe_payment_intent_id ELSE NULL END,
    v_work_order.notes,
    p_user_id,
    v_work_order.trip_inspection_id
  ) RETURNING id INTO v_invoice_id;

  -- Re-point any orphaned estimating_payments rows to the new invoice
  UPDATE estimating_payments
  SET invoice_id = v_invoice_id, updated_at = now()
  WHERE work_order_id = p_work_order_id
    AND invoice_id IS NULL;

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
