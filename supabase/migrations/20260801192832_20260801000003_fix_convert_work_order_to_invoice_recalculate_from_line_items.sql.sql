/*
  # Fix convert_work_order_to_invoice to Recalculate Totals from Line Items

  ## Problem
  The convert_work_order_to_invoice function reads subtotal, tax, surcharge, shop
  supplies, and park fees directly from the work_orders header. If the work order
  header was updated AFTER the invoice was created (a race condition that occurred
  in 3 known cases), the invoice locks in stale values while the line items are correct.

  ## Fix
  Replace the function with a version that recalculates all financial summary fields
  directly from work_order_line_items (joined to work_order_tasks for surcharge
  applicability) instead of trusting work_orders header columns.

  ### What changed:
  - Subtotal: SUM of all line item total_price
  - Taxable subtotal: SUM of line item total_price WHERE is_taxable = true
  - Tax: taxable_subtotal × work_orders.sales_tax_rate
  - Shop supplies: subtotal × work_orders.shop_supplies_rate (only if shop_supplies_amount > 0)
  - Park fees: subtotal × work_orders.park_fees_rate (only if park_fees_amount > 0)
  - Surcharge: surchargeable_subtotal × work_orders.surcharge_rate, capped at estimate_settings.surcharge_cap
  - Discount: subtotal × work_orders.discount (rate stored as decimal, e.g. 0.25 = 25%)
  - Total: subtotal + tax + shop_supplies + park_fees + surcharge - discount

  ### What stayed the same:
  - All deposit/payment/balance logic is unchanged
  - Line item copying is unchanged
  - Repair request linking is unchanged
  - All other invoice fields (customer info, dates, notes, etc.) are unchanged

  ## Important Notes
  1. The rates (sales_tax_rate, shop_supplies_rate, park_fees_rate, surcharge_rate)
     still come from the work order header — these are user-set values that don't
     change during the race window. Only the computed AMOUNTS are recalculated.
  2. Shop supplies and park fees are only applied if the work order has a non-zero
     stored amount, which indicates the user opted in. This matches the frontend
     logic where apply_shop_supplies/apply_park_fees toggles control whether these
     are calculated.
*/
DROP FUNCTION IF EXISTS convert_work_order_to_invoice(uuid, uuid);

CREATE OR REPLACE FUNCTION convert_work_order_to_invoice(
  p_work_order_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Tax: taxable subtotal × rate
  v_tax_amount := v_taxable_subtotal * COALESCE(v_work_order.sales_tax_rate, 0);

  -- Shop supplies: only if the work order had shop supplies enabled (stored amount > 0)
  IF COALESCE(v_work_order.shop_supplies_amount, 0) > 0 THEN
    v_shop_supplies_amount := v_subtotal * COALESCE(v_work_order.shop_supplies_rate, 0);
  ELSE
    v_shop_supplies_amount := 0;
  END IF;

  -- Park fees: only if the work order had park fees enabled (stored amount > 0)
  IF COALESCE(v_work_order.park_fees_amount, 0) > 0 THEN
    v_park_fees_amount := v_subtotal * COALESCE(v_work_order.park_fees_rate, 0);
  ELSE
    v_park_fees_amount := 0;
  END IF;

  -- Surcharge: surchargeable subtotal × rate, capped at settings cap
  v_surcharge_amount := v_surchargeable_subtotal * COALESCE(v_work_order.surcharge_rate, 0);

  SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;
  v_capped_surcharge := CASE
    WHEN v_surcharge_cap IS NOT NULL AND v_surcharge_amount > v_surcharge_cap
    THEN v_surcharge_cap
    ELSE v_surcharge_amount
  END;

  -- Discount (rate stored as decimal, e.g. 0.25 = 25%)
  v_discount_rate := COALESCE(v_work_order.discount, 0);
  v_discount_amount := v_subtotal * v_discount_rate;

  v_capped_total := v_subtotal
    + v_tax_amount
    + v_shop_supplies_amount
    + v_park_fees_amount
    + v_capped_surcharge
    - v_discount_amount;

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

  -- === Check prior payments ===
  SELECT
    COALESCE(SUM(ep.amount), 0),
    MAX(ep.payment_date),
    MAX(ep.payment_method_type),
    MAX(ep.stripe_payment_intent_id)
  INTO v_total_paid, v_paid_at, v_payment_method_type, v_stripe_payment_intent_id
  FROM estimating_payments ep
  WHERE ep.work_order_id = p_work_order_id;

  v_balance_due := GREATEST(0, v_capped_total - v_deposit_applied - v_total_paid);

  IF v_balance_due <= 0 THEN
    v_payment_status := 'paid';
  ELSIF v_total_paid > 0 OR v_deposit_applied > 0 THEN
    v_payment_status := 'partial';
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
    company_id
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
    v_subtotal,
    v_work_order.sales_tax_rate,
    v_tax_amount,
    v_shop_supplies_amount,
    v_park_fees_amount,
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
    v_work_order.company_id
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