/*
  # Create Parts Inventory System

  1. New Tables
    - `parts_inventory`
      - `id` (uuid, primary key)
      - `part_number` (text, unique) - The part number/SKU
      - `name` (text) - Part name
      - `description` (text, nullable) - Detailed description
      - `manufacturer` (text, nullable) - Manufacturer name
      - `category` (text) - Part category
      - `quantity_on_hand` (integer) - Current stock quantity
      - `unit_cost` (numeric) - Cost per unit
      - `unit_price` (numeric) - Selling price per unit
      - `reorder_level` (integer) - Minimum quantity before reorder
      - `reorder_quantity` (integer) - Default reorder quantity
      - `location` (text, nullable) - Storage location
      - `accounting_code_id` (uuid, foreign key) - Reference to accounting code
      - `is_active` (boolean) - Whether this part is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to user_profiles)

    - `part_transactions`
      - `id` (uuid, primary key)
      - `part_id` (uuid, foreign key) - Reference to parts_inventory
      - `transaction_type` (text) - add, remove, adjustment, sale, return
      - `quantity_change` (integer) - Quantity changed (positive or negative)
      - `before_quantity` (integer) - Quantity before transaction
      - `after_quantity` (integer) - Quantity after transaction
      - `transaction_date` (timestamptz) - When transaction occurred
      - `work_order_id` (uuid, nullable) - Reference to work order if applicable
      - `estimate_id` (uuid, nullable) - Reference to estimate if applicable
      - `performed_by` (uuid, foreign key) - Who performed the transaction
      - `reason` (text, nullable) - Reason for transaction
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for master users to manage inventory
*/

CREATE TABLE IF NOT EXISTS parts_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  manufacturer text,
  category text NOT NULL,
  quantity_on_hand integer DEFAULT 0 NOT NULL,
  unit_cost numeric(10, 2) DEFAULT 0 NOT NULL,
  unit_price numeric(10, 2) DEFAULT 0 NOT NULL,
  reorder_level integer DEFAULT 0 NOT NULL,
  reorder_quantity integer DEFAULT 0 NOT NULL,
  location text,
  accounting_code_id uuid REFERENCES accounting_codes(id),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES user_profiles(user_id)
);

CREATE TABLE IF NOT EXISTS part_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid REFERENCES parts_inventory(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('add', 'remove', 'adjustment', 'sale', 'return')),
  quantity_change integer NOT NULL,
  before_quantity integer NOT NULL,
  after_quantity integer NOT NULL,
  transaction_date timestamptz DEFAULT now() NOT NULL,
  work_order_id uuid,
  estimate_id uuid,
  performed_by uuid REFERENCES user_profiles(user_id) NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_parts_inventory_part_number ON parts_inventory(part_number);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_category ON parts_inventory(category);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_active ON parts_inventory(is_active);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_low_stock ON parts_inventory(quantity_on_hand, reorder_level);
CREATE INDEX IF NOT EXISTS idx_part_transactions_part_id ON part_transactions(part_id);
CREATE INDEX IF NOT EXISTS idx_part_transactions_date ON part_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_part_transactions_work_order ON part_transactions(work_order_id);

-- Enable RLS
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_transactions ENABLE ROW LEVEL SECURITY;

-- Master users can manage parts inventory
CREATE POLICY "Master users can view parts inventory"
  ON parts_inventory
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

CREATE POLICY "Master users can insert parts"
  ON parts_inventory
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

CREATE POLICY "Master users can update parts"
  ON parts_inventory
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

CREATE POLICY "Master users can delete parts"
  ON parts_inventory
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

-- Master users can view and manage part transactions
CREATE POLICY "Master users can view part transactions"
  ON part_transactions
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

CREATE POLICY "Master users can insert part transactions"
  ON part_transactions
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parts_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parts_inventory_updated_at
  BEFORE UPDATE ON parts_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_inventory_updated_at();