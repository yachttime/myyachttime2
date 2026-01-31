/*
  # Create Labor Codes Table

  1. New Tables
    - `labor_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique) - The labor code identifier
      - `name` (text) - Display name for the labor type
      - `description` (text, nullable) - Optional description
      - `hourly_rate` (numeric) - Standard hourly rate
      - `overtime_rate` (numeric, nullable) - Overtime hourly rate
      - `accounting_code_id` (uuid, foreign key) - Reference to accounting code
      - `is_active` (boolean) - Whether this code is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to user_profiles)

  2. Security
    - Enable RLS on `labor_codes` table
    - Add policy for master users to manage labor codes
    - Add policy for staff to view labor codes
*/

CREATE TABLE IF NOT EXISTS labor_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  hourly_rate numeric(10, 2) NOT NULL DEFAULT 0,
  overtime_rate numeric(10, 2),
  accounting_code_id uuid REFERENCES accounting_codes(id),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES user_profiles(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_labor_codes_code ON labor_codes(code);
CREATE INDEX IF NOT EXISTS idx_labor_codes_active ON labor_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_labor_codes_accounting ON labor_codes(accounting_code_id);

-- Enable RLS
ALTER TABLE labor_codes ENABLE ROW LEVEL SECURITY;

-- Master users can manage all labor codes
CREATE POLICY "Master users can view labor codes"
  ON labor_codes
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

CREATE POLICY "Master users can insert labor codes"
  ON labor_codes
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

CREATE POLICY "Master users can update labor codes"
  ON labor_codes
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

CREATE POLICY "Master users can delete labor codes"
  ON labor_codes
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
CREATE OR REPLACE FUNCTION update_labor_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER labor_codes_updated_at
  BEFORE UPDATE ON labor_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_labor_codes_updated_at();