/*
  # Create Estimating Invoices Table

  1. New Tables
    - `estimating_invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique) - Auto-generated invoice number
      - `work_order_id` (uuid, foreign key) - Reference to work order
      - `estimate_id` (uuid, foreign key) - Reference to original estimate
      - `yacht_id` (uuid, nullable) - Reference to yacht if not retail
      - `customer_name` (text) - Customer name
      - `customer_email` (text) - Customer email
      - `customer_phone` (text, nullable) - Customer phone
      - `is_retail_customer` (boolean) - Whether this is a retail customer
      - `invoice_date` (date) - Date invoice was created
      - `due_date` (date) - Payment due date
      - `subtotal` (numeric) - Subtotal before tax
      - `tax_rate` (numeric) - Sales tax rate
      - `tax_amount` (numeric) - Tax amount
      - `total_amount` (numeric) - Total amount due
      - `amount_paid` (numeric) - Amount paid so far
      - `payment_status` (text) - unpaid, partial, paid
      - `quickbooks_export_status` (text) - not_exported, pending, exported, error
      - `quickbooks_invoice_id` (text, nullable) - QuickBooks invoice ID
      - `quickbooks_export_date` (timestamptz, nullable) - When exported to QB
      - `quickbooks_export_error` (text, nullable) - Error message if export failed
      - `notes` (text, nullable) - Internal notes
      - `created_by` (uuid, foreign key) - Who created the invoice
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Add policies for master users to manage invoices
*/

CREATE TABLE IF NOT EXISTS estimating_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  work_order_id uuid REFERENCES work_orders(id) NOT NULL,
  estimate_id uuid REFERENCES estimates(id) NOT NULL,
  yacht_id uuid REFERENCES yachts(id),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  is_retail_customer boolean DEFAULT false NOT NULL,
  invoice_date date DEFAULT CURRENT_DATE NOT NULL,
  due_date date,
  subtotal numeric(10, 2) DEFAULT 0 NOT NULL,
  tax_rate numeric(5, 4) DEFAULT 0 NOT NULL,
  tax_amount numeric(10, 2) DEFAULT 0 NOT NULL,
  total_amount numeric(10, 2) DEFAULT 0 NOT NULL,
  amount_paid numeric(10, 2) DEFAULT 0 NOT NULL,
  payment_status text DEFAULT 'unpaid' NOT NULL CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  quickbooks_export_status text DEFAULT 'not_exported' NOT NULL CHECK (quickbooks_export_status IN ('not_exported', 'pending', 'exported', 'error')),
  quickbooks_invoice_id text,
  quickbooks_export_date timestamptz,
  quickbooks_export_error text,
  notes text,
  created_by uuid REFERENCES user_profiles(user_id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_number ON estimating_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_work_order ON estimating_invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_estimate ON estimating_invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_yacht ON estimating_invoices(yacht_id);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_payment_status ON estimating_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_export_status ON estimating_invoices(quickbooks_export_status);

-- Enable RLS
ALTER TABLE estimating_invoices ENABLE ROW LEVEL SECURITY;

-- Master users can manage invoices
CREATE POLICY "Master users can view estimating invoices"
  ON estimating_invoices
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

CREATE POLICY "Master users can insert estimating invoices"
  ON estimating_invoices
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

CREATE POLICY "Master users can update estimating invoices"
  ON estimating_invoices
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

CREATE POLICY "Master users can delete estimating invoices"
  ON estimating_invoices
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_estimating_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimating_invoices_updated_at
  BEFORE UPDATE ON estimating_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_estimating_invoices_updated_at();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_estimating_invoice_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM estimating_invoices
  WHERE invoice_number ~ '^INV[0-9]+$';
  
  new_number := 'INV' || LPAD(next_num::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;