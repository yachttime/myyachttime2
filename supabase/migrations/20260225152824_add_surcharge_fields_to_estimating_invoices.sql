/*
  # Add Surcharge and Fee Fields to Estimating Invoices

  ## Summary
  Adds shop supplies, park fees, and surcharge amount columns to the estimating_invoices
  table so these collected fees are stored on the invoice for reporting purposes.

  ## New Columns
  - `shop_supplies_amount` - Dollar amount collected for shop supplies fee
  - `park_fees_amount` - Dollar amount collected for park fees
  - `surcharge_amount` - Dollar amount collected for surcharge/environmental fee

  ## Updated Function
  - Updates `convert_work_order_to_invoice` to copy fee amounts from the work order

  ## Notes
  - All columns default to 0 to ensure backward compatibility with existing invoices
  - The convert function now captures these amounts at the time of invoice creation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'shop_supplies_amount'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN shop_supplies_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'park_fees_amount'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN park_fees_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_amount'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

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

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
