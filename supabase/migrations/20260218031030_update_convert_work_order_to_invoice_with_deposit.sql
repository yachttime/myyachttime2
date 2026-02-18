/*
  # Update Convert Work Order to Invoice with Deposit Transfer

  ## Changes
  - Drops and recreates the `convert_work_order_to_invoice` function
  - Transfers deposit information from work order to invoice
  - Calculates balance_due automatically
  - Applies deposit if it was paid
*/

DROP FUNCTION IF EXISTS convert_work_order_to_invoice(uuid, uuid);

CREATE OR REPLACE FUNCTION convert_work_order_to_invoice(
  p_work_order_id uuid,
  p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_work_order record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_line_item record;
  v_line_order integer;
  v_deposit_applied numeric;
BEGIN
  SELECT * INTO v_work_order
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  IF v_work_order.status != 'completed' THEN
    RAISE EXCEPTION 'Work order must be completed before converting to invoice';
  END IF;

  IF EXISTS (SELECT 1 FROM estimating_invoices WHERE work_order_id = p_work_order_id) THEN
    RAISE EXCEPTION 'Invoice already exists for this work order';
  END IF;

  v_invoice_number := generate_estimating_invoice_number();

  -- Determine deposit amount to apply
  v_deposit_applied := 0;
  IF v_work_order.deposit_payment_status = 'paid' AND v_work_order.deposit_amount IS NOT NULL THEN
    v_deposit_applied := v_work_order.deposit_amount;
  END IF;

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
    total_amount,
    deposit_applied,
    balance_due,
    amount_paid,
    notes,
    created_by,
    company_id
  ) VALUES (
    v_invoice_number,
    p_work_order_id,
    v_work_order.estimate_id,
    v_work_order.yacht_id,
    v_work_order.customer_name,
    v_work_order.customer_email,
    v_work_order.customer_phone,
    v_work_order.is_retail_customer,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_work_order.subtotal,
    v_work_order.sales_tax_rate,
    v_work_order.sales_tax_amount,
    v_work_order.total_amount,
    v_deposit_applied,
    v_work_order.total_amount - v_deposit_applied,
    0,
    v_work_order.notes,
    p_user_id,
    v_work_order.company_id
  ) RETURNING id INTO v_invoice_id;

  -- Copy line items from work order to invoice
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

  -- Create payment record for the deposit if it was paid
  IF v_deposit_applied > 0 THEN
    INSERT INTO estimating_payments (
      company_id,
      payment_type,
      work_order_id,
      invoice_id,
      estimate_id,
      yacht_id,
      customer_name,
      customer_email,
      customer_phone,
      is_retail_customer,
      amount,
      payment_date,
      payment_method,
      payment_method_type,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      quickbooks_payment_id,
      notes,
      recorded_by
    ) VALUES (
      v_work_order.company_id,
      'deposit',
      p_work_order_id,
      v_invoice_id,
      v_work_order.estimate_id,
      v_work_order.yacht_id,
      v_work_order.customer_name,
      v_work_order.customer_email,
      v_work_order.customer_phone,
      v_work_order.is_retail_customer,
      v_deposit_applied,
      v_work_order.deposit_paid_at,
      'stripe',
      v_work_order.deposit_payment_method_type,
      v_work_order.deposit_stripe_checkout_session_id,
      v_work_order.deposit_stripe_payment_intent_id,
      v_work_order.deposit_quickbooks_payment_id,
      'Deposit applied from work order ' || v_work_order.work_order_number,
      p_user_id
    );
  END IF;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;