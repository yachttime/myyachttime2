-- Update convert_work_order_to_invoice to set due_date = invoice_date (due on receipt)
CREATE OR REPLACE FUNCTION convert_work_order_to_invoice(p_work_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_line_items JSONB;
  v_labor_total NUMERIC;
  v_parts_total NUMERIC;
  v_subtotal NUMERIC;
  v_tax_rate NUMERIC := 0;
  v_tax_amount NUMERIC;
  v_total NUMERIC;
BEGIN
  -- Get work order details
  SELECT wo.*, y.name as yacht_name
  INTO v_work_order
  FROM work_orders wo
  LEFT JOIN yachts y ON wo.yacht_id = y.id
  WHERE wo.id = p_work_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found: %', p_work_order_id;
  END IF;

  -- Generate invoice number
  v_invoice_number := generate_estimating_invoice_number();

  -- Build line items from work order tasks
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'description', COALESCE(t.description, t.task_name),
      'quantity', COALESCE(t.hours, 1),
      'unit_price', COALESCE(t.rate, 0),
      'amount', COALESCE(t.hours, 1) * COALESCE(t.rate, 0),
      'type', 'labor'
    )
  ), '[]'::jsonb)
  INTO v_line_items
  FROM work_order_tasks t
  WHERE t.work_order_id = p_work_order_id;

  -- Calculate totals
  SELECT
    COALESCE(SUM(CASE WHEN item->>'type' = 'labor' THEN (item->>'amount')::NUMERIC ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN item->>'type' = 'parts' THEN (item->>'amount')::NUMERIC ELSE 0 END), 0)
  INTO v_labor_total, v_parts_total
  FROM jsonb_array_elements(v_line_items) item;

  v_subtotal := v_labor_total + v_parts_total;
  v_tax_amount := v_subtotal * v_tax_rate;
  v_total := v_subtotal + v_tax_amount;

  -- Create invoice with due_date = invoice_date (due on receipt)
  INSERT INTO estimating_invoices (
    invoice_number,
    client_name,
    yacht_name,
    invoice_date,
    due_date,
    line_items,
    labor_total,
    parts_total,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    payment_status,
    work_order_id,
    yacht_id
  ) VALUES (
    v_invoice_number,
    v_work_order.client_name,
    v_work_order.yacht_name,
    CURRENT_DATE,
    CURRENT_DATE,
    v_line_items,
    v_labor_total,
    v_parts_total,
    v_subtotal,
    v_tax_rate,
    v_tax_amount,
    v_total,
    'draft',
    p_work_order_id,
    v_work_order.yacht_id
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- Update all unpaid invoices so due_date = invoice_date (due on receipt)
UPDATE estimating_invoices
SET due_date = invoice_date
WHERE payment_status NOT IN ('paid')
  AND due_date != invoice_date;
