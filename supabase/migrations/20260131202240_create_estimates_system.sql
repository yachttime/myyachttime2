/*
  # Create Estimates System

  1. New Tables
    - `estimates`
      - `id` (uuid, primary key)
      - `estimate_number` (text, unique) - Auto-generated estimate number
      - `yacht_id` (uuid, nullable) - Reference to yacht if not retail
      - `customer_name` (text, nullable) - For retail customers
      - `customer_email` (text, nullable) - For retail customers
      - `customer_phone` (text, nullable) - For retail customers
      - `is_retail_customer` (boolean) - Whether this is a retail customer
      - `status` (text) - draft, sent, approved, rejected, converted
      - `subtotal` (numeric) - Subtotal before tax
      - `tax_rate` (numeric) - Sales tax rate as decimal (e.g., 0.08 for 8%)
      - `tax_amount` (numeric) - Calculated tax amount
      - `total_amount` (numeric) - Final total including tax
      - `notes` (text, nullable) - Internal notes
      - `customer_notes` (text, nullable) - Notes visible to customer
      - `valid_until` (date, nullable) - Expiration date for estimate
      - `created_by` (uuid, foreign key) - Who created the estimate
      - `approved_by` (uuid, nullable) - Who approved the estimate
      - `approved_at` (timestamptz, nullable) - When approved
      - `sent_at` (timestamptz, nullable) - When sent to customer
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `estimate_line_items`
      - `id` (uuid, primary key)
      - `estimate_id` (uuid, foreign key) - Reference to estimate
      - `line_type` (text) - labor, part, shop_supplies, park_fees, surcharge
      - `description` (text) - Line item description
      - `quantity` (numeric) - Quantity
      - `unit_price` (numeric) - Price per unit
      - `total_price` (numeric) - Total for this line (quantity * unit_price)
      - `labor_code_id` (uuid, nullable) - Reference to labor code if labor line
      - `part_id` (uuid, nullable) - Reference to part if part line
      - `accounting_code_id` (uuid, nullable) - Override accounting code
      - `line_order` (integer) - Order of line items for display
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for master users to manage estimates
*/

CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number text UNIQUE NOT NULL,
  yacht_id uuid REFERENCES yachts(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  is_retail_customer boolean DEFAULT false NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'converted')),
  subtotal numeric(10, 2) DEFAULT 0 NOT NULL,
  tax_rate numeric(5, 4) DEFAULT 0 NOT NULL,
  tax_amount numeric(10, 2) DEFAULT 0 NOT NULL,
  total_amount numeric(10, 2) DEFAULT 0 NOT NULL,
  notes text,
  customer_notes text,
  valid_until date,
  created_by uuid REFERENCES user_profiles(user_id) NOT NULL,
  approved_by uuid REFERENCES user_profiles(user_id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT estimate_customer_check CHECK (
    (yacht_id IS NOT NULL AND is_retail_customer = false) OR
    (customer_name IS NOT NULL AND is_retail_customer = true)
  )
);

CREATE TABLE IF NOT EXISTS estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE NOT NULL,
  line_type text NOT NULL CHECK (line_type IN ('labor', 'part', 'shop_supplies', 'park_fees', 'surcharge')),
  description text NOT NULL,
  quantity numeric(10, 2) DEFAULT 1 NOT NULL,
  unit_price numeric(10, 2) DEFAULT 0 NOT NULL,
  total_price numeric(10, 2) DEFAULT 0 NOT NULL,
  labor_code_id uuid REFERENCES labor_codes(id),
  part_id uuid REFERENCES parts_inventory(id),
  accounting_code_id uuid REFERENCES accounting_codes(id),
  line_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_estimates_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_yacht_id ON estimates(yacht_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_by ON estimates(created_by);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate_id ON estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_type ON estimate_line_items(line_type);

-- Enable RLS
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;

-- Master users can manage estimates
CREATE POLICY "Master users can view estimates"
  ON estimates
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

CREATE POLICY "Master users can insert estimates"
  ON estimates
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

CREATE POLICY "Master users can update estimates"
  ON estimates
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

CREATE POLICY "Master users can delete estimates"
  ON estimates
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

-- Master users can manage estimate line items
CREATE POLICY "Master users can view estimate line items"
  ON estimate_line_items
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

CREATE POLICY "Master users can insert estimate line items"
  ON estimate_line_items
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

CREATE POLICY "Master users can update estimate line items"
  ON estimate_line_items
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

CREATE POLICY "Master users can delete estimate line items"
  ON estimate_line_items
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
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();

CREATE OR REPLACE FUNCTION update_estimate_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_line_items_updated_at
  BEFORE UPDATE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_line_items_updated_at();

-- Function to generate estimate number
CREATE OR REPLACE FUNCTION generate_estimate_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(estimate_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM estimates
  WHERE estimate_number ~ '^EST[0-9]+$';
  
  new_number := 'EST' || LPAD(next_num::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;