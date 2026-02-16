/*
  # Create Estimate Packages System

  1. New Tables
    - `estimate_packages`
      - `id` (uuid, primary key)
      - `name` (text) - Package name
      - `description` (text) - Package description
      - `is_active` (boolean) - Active status
      - `created_by` (uuid) - User who created the package
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `estimate_package_labor`
      - `id` (uuid, primary key)
      - `package_id` (uuid) - Foreign key to estimate_packages
      - `labor_code_id` (uuid) - Foreign key to labor_codes
      - `hours` (numeric) - Number of hours
      - `rate` (numeric) - Labor rate
      - `description` (text) - Optional description override
      - `created_at` (timestamptz)
    
    - `estimate_package_parts`
      - `id` (uuid, primary key)
      - `package_id` (uuid) - Foreign key to estimate_packages
      - `part_id` (uuid) - Foreign key to parts_inventory
      - `quantity` (numeric) - Quantity of part
      - `unit_price` (numeric) - Price per unit
      - `description` (text) - Optional description override
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for staff and master roles to manage packages
*/

-- Create estimate_packages table
CREATE TABLE IF NOT EXISTS estimate_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create estimate_package_labor table
CREATE TABLE IF NOT EXISTS estimate_package_labor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES estimate_packages(id) ON DELETE CASCADE NOT NULL,
  labor_code_id uuid REFERENCES labor_codes(id) NOT NULL,
  hours numeric(10,2) NOT NULL DEFAULT 0,
  rate numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create estimate_package_parts table
CREATE TABLE IF NOT EXISTS estimate_package_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES estimate_packages(id) ON DELETE CASCADE NOT NULL,
  part_id uuid REFERENCES parts_inventory(id) NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_parts ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimate_package_labor_package_id ON estimate_package_labor(package_id);
CREATE INDEX IF NOT EXISTS idx_estimate_package_parts_package_id ON estimate_package_parts(package_id);
CREATE INDEX IF NOT EXISTS idx_estimate_packages_is_active ON estimate_packages(is_active);

-- RLS Policies for estimate_packages
CREATE POLICY "Staff and master can view packages"
  ON estimate_packages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can insert packages"
  ON estimate_packages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can update packages"
  ON estimate_packages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can delete packages"
  ON estimate_packages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- RLS Policies for estimate_package_labor
CREATE POLICY "Staff and master can view package labor"
  ON estimate_package_labor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can insert package labor"
  ON estimate_package_labor FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can update package labor"
  ON estimate_package_labor FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can delete package labor"
  ON estimate_package_labor FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- RLS Policies for estimate_package_parts
CREATE POLICY "Staff and master can view package parts"
  ON estimate_package_parts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can insert package parts"
  ON estimate_package_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can update package parts"
  ON estimate_package_parts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

CREATE POLICY "Staff and master can delete package parts"
  ON estimate_package_parts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );