/*
  # Create Accounting Codes Table

  1. New Tables
    - `accounting_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique) - The accounting code identifier
      - `name` (text) - Display name for the code
      - `description` (text, nullable) - Optional description
      - `account_type` (text) - Type: income, expense, asset, liability
      - `quickbooks_account_id` (text, nullable) - QuickBooks account mapping
      - `is_active` (boolean) - Whether this code is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to user_profiles)

  2. Security
    - Enable RLS on `accounting_codes` table
    - Add policy for master users to manage accounting codes
    - Add policy for staff to view accounting codes
*/

CREATE TABLE IF NOT EXISTS accounting_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  account_type text NOT NULL CHECK (account_type IN ('income', 'expense', 'asset', 'liability')),
  quickbooks_account_id text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES user_profiles(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounting_codes_code ON accounting_codes(code);
CREATE INDEX IF NOT EXISTS idx_accounting_codes_active ON accounting_codes(is_active);

-- Enable RLS
ALTER TABLE accounting_codes ENABLE ROW LEVEL SECURITY;

-- Master users can manage all accounting codes
CREATE POLICY "Master users can view accounting codes"
  ON accounting_codes
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

CREATE POLICY "Master users can insert accounting codes"
  ON accounting_codes
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

CREATE POLICY "Master users can update accounting codes"
  ON accounting_codes
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

CREATE POLICY "Master users can delete accounting codes"
  ON accounting_codes
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
CREATE OR REPLACE FUNCTION update_accounting_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounting_codes_updated_at
  BEFORE UPDATE ON accounting_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_accounting_codes_updated_at();