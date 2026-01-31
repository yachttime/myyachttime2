/*
  # Create Estimate Settings Table

  1. New Tables
    - `estimate_settings`
      - `id` (uuid, primary key)
      - `sales_tax_rate` (numeric) - Sales tax percentage (e.g., 0.08 for 8%)
      - `shop_supplies_rate` (numeric) - Shop supplies percentage
      - `park_fees_rate` (numeric) - National park fees percentage
      - `surcharge_rate` (numeric) - Surcharge percentage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on estimate_settings table
    - Master users can view and manage estimate settings
    - Only one row should exist (singleton pattern)

  3. Notes
    - Insert default values
    - All rates stored as decimals (e.g., 0.08 for 8%)
*/

-- Create estimate_settings table
CREATE TABLE IF NOT EXISTS estimate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_tax_rate numeric(5,4) DEFAULT 0.08 NOT NULL,
  shop_supplies_rate numeric(5,4) DEFAULT 0.05 NOT NULL,
  park_fees_rate numeric(5,4) DEFAULT 0.02 NOT NULL,
  surcharge_rate numeric(5,4) DEFAULT 0.03 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default settings if none exist
INSERT INTO estimate_settings (sales_tax_rate, shop_supplies_rate, park_fees_rate, surcharge_rate)
SELECT 0.08, 0.05, 0.02, 0.03
WHERE NOT EXISTS (SELECT 1 FROM estimate_settings);

-- Enable RLS
ALTER TABLE estimate_settings ENABLE ROW LEVEL SECURITY;

-- Master users can view estimate settings
CREATE POLICY "Master users can view estimate settings"
  ON estimate_settings
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

-- Master users can update estimate settings
CREATE POLICY "Master users can update estimate settings"
  ON estimate_settings
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_estimate_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_settings_updated_at
  BEFORE UPDATE ON estimate_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_settings_updated_at();
