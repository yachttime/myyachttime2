/*
  # Add Work Order to Invoice Conversion System
  
  1. New Tables
    - `estimating_invoice_line_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key) - Reference to estimating_invoices
      - `task_name` (text) - Name of the task
      - `line_type` (text) - Type: labor, part, shop_supplies, park_fees, surcharge
      - `description` (text) - Line item description
      - `quantity` (numeric) - Quantity
      - `unit_price` (numeric) - Price per unit
      - `total_price` (numeric) - Total line price
      - `is_taxable` (boolean) - Whether item is taxable
      - `labor_code_id` (uuid, nullable) - Reference to labor code
      - `part_id` (uuid, nullable) - Reference to part
      - `line_order` (integer) - Display order
      - `work_details` (text, nullable) - Detailed work description
      - `created_at` (timestamptz)

  2. New Function
    - `convert_work_order_to_invoice(work_order_id, user_id)` - Converts completed work order to invoice
      - Validates work order is completed
      - Creates invoice record
      - Copies all line items from work order
      - Returns invoice ID

  3. Security
    - Enable RLS on estimating_invoice_line_items
    - Master users can manage line items
*/

-- Create estimating_invoice_line_items table
CREATE TABLE IF NOT EXISTS estimating_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES estimating_invoices(id) ON DELETE CASCADE NOT NULL,
  task_name text NOT NULL,
  line_type text NOT NULL CHECK (line_type IN ('labor', 'part', 'shop_supplies', 'park_fees', 'surcharge')),
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL,
  unit_price numeric(10, 2) NOT NULL,
  total_price numeric(10, 2) NOT NULL,
  is_taxable boolean DEFAULT false NOT NULL,
  labor_code_id uuid REFERENCES labor_codes(id),
  part_id uuid REFERENCES parts_inventory(id),
  line_order integer NOT NULL,
  work_details text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_estimating_invoice_line_items_invoice ON estimating_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_estimating_invoice_line_items_order ON estimating_invoice_line_items(invoice_id, line_order);

-- Enable RLS
ALTER TABLE estimating_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Master users can view invoice line items
CREATE POLICY "Master users can view invoice line items"
  ON estimating_invoice_line_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Master users can insert invoice line items
CREATE POLICY "Master users can insert invoice line items"
  ON estimating_invoice_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Master users can update invoice line items
CREATE POLICY "Master users can update invoice line items"
  ON estimating_invoice_line_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Master users can delete invoice line items
CREATE POLICY "Master users can delete invoice line items"
  ON estimating_invoice_line_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Function to convert work order to invoice
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
BEGIN
  -- Get work order details
  SELECT * INTO v_work_order
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  -- Check if work order is completed
  IF v_work_order.status != 'completed' THEN
    RAISE EXCEPTION 'Work order must be completed before converting to invoice';
  END IF;

  -- Check if invoice already exists for this work order
  IF EXISTS (SELECT 1 FROM estimating_invoices WHERE work_order_id = p_work_order_id) THEN
    RAISE EXCEPTION 'Invoice already exists for this work order';
  END IF;

  -- Generate invoice number
  v_invoice_number := generate_estimating_invoice_number();

  -- Create invoice
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
    notes,
    created_by
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
    v_work_order.notes,
    p_user_id
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

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;