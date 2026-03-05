/*
  # Link Estimating Invoice to Repair Request

  ## Overview
  When a work order that originated from an estimate (which was sent to a repair request)
  gets converted to an invoice, we need to link that estimating invoice back to the
  repair request so both show in the same place.

  ## Changes

  ### 1. New Column on `repair_requests`
  - `estimating_invoice_id` (uuid, FK to estimating_invoices) - set when a work order
    derived from this repair request's estimate is converted to an invoice

  ### 2. Updated `convert_work_order_to_invoice` function
  - After creating the estimating invoice, checks if the work order's estimate_id
    is linked to a repair request
  - If yes: sets `repair_requests.estimating_invoice_id` to the new invoice ID
    and updates the repair request status to 'completed'

  ## Notes
  - This is additive only - no existing data is changed
  - The repair request card in the dashboard will need to check this field
    to display the estimating invoice when no yacht_invoice exists
*/

ALTER TABLE repair_requests
  ADD COLUMN IF NOT EXISTS estimating_invoice_id uuid REFERENCES estimating_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repair_requests_estimating_invoice_id
  ON repair_requests(estimating_invoice_id);

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
  v_customer_name text;
  v_yacht_name text;
  v_repair_request_id uuid;
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

  -- If the work order came from an estimate, link the invoice back to the repair request
  IF v_work_order.estimate_id IS NOT NULL THEN
    SELECT id INTO v_repair_request_id
    FROM repair_requests
    WHERE estimate_id = v_work_order.estimate_id
    LIMIT 1;

    IF v_repair_request_id IS NOT NULL THEN
      UPDATE repair_requests
      SET
        estimating_invoice_id = v_invoice_id,
        status = 'completed'
      WHERE id = v_repair_request_id;
    END IF;
  END IF;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION convert_work_order_to_invoice(uuid, uuid) TO authenticated;
