/*
  # Create Vendors Table and Update Parts Inventory

  1. New Tables
    - `vendors`
      - `id` (uuid, primary key)
      - `vendor_name` (text, unique) - Vendor company name
      - `contact_name` (text, nullable) - Primary contact person
      - `phone` (text, nullable) - Phone number
      - `email` (text, nullable) - Email address
      - `address` (text, nullable) - Street address
      - `city` (text, nullable) - City
      - `state` (text, nullable) - State
      - `zip` (text, nullable) - ZIP code
      - `notes` (text, nullable) - Additional notes
      - `is_active` (boolean) - Whether vendor is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Update `parts_inventory`:
      - Remove `category` column
      - Remove `manufacturer` column
      - Add `vendor_id` (uuid, foreign key to vendors)
      - Add `msrp` (numeric) - Manufacturer's suggested retail price
      - Add `alternative_part_numbers` (text, nullable) - Alternative part numbers for cross-reference

  3. Security
    - Enable RLS on vendors table
    - Add policies for master users to manage vendors

  4. Important Notes
    - Existing category data will be lost
    - Existing manufacturer data will be lost
    - This is a breaking change that requires manual data migration if needed
*/

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text UNIQUE NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Drop category index if it exists
DROP INDEX IF EXISTS idx_parts_inventory_category;

-- Remove category and manufacturer columns from parts_inventory
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_inventory' AND column_name = 'category'
  ) THEN
    ALTER TABLE parts_inventory DROP COLUMN category;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_inventory' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE parts_inventory DROP COLUMN manufacturer;
  END IF;
END $$;

-- Add new columns to parts_inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_inventory' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE parts_inventory ADD COLUMN vendor_id uuid REFERENCES vendors(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_inventory' AND column_name = 'msrp'
  ) THEN
    ALTER TABLE parts_inventory ADD COLUMN msrp numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_inventory' AND column_name = 'alternative_part_numbers'
  ) THEN
    ALTER TABLE parts_inventory ADD COLUMN alternative_part_numbers text;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_parts_inventory_vendor_id ON parts_inventory(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);

-- Enable RLS on vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Master users can manage vendors
CREATE POLICY "Master users can view vendors"
  ON vendors
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

CREATE POLICY "Master users can insert vendors"
  ON vendors
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

CREATE POLICY "Master users can update vendors"
  ON vendors
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

CREATE POLICY "Master users can delete vendors"
  ON vendors
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
CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendors_updated_at();
