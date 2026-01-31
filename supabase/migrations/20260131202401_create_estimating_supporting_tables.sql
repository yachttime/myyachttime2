/*
  # Create Estimating Supporting Tables

  1. New Tables
    - `quickbooks_export_log`
      - `id` (uuid, primary key)
      - `export_type` (text) - estimate, work_order, invoice, payment
      - `entity_id` (uuid) - ID of the exported entity
      - `entity_number` (text) - Number of the exported entity
      - `export_status` (text) - pending, success, error
      - `quickbooks_id` (text, nullable) - QuickBooks entity ID
      - `request_payload` (jsonb, nullable) - Data sent to QuickBooks
      - `response_payload` (jsonb, nullable) - Response from QuickBooks
      - `error_message` (text, nullable) - Error message if failed
      - `exported_by` (uuid, foreign key) - Who initiated the export
      - `exported_at` (timestamptz) - When export was attempted
      - `created_at` (timestamptz)

    - `estimate_fees_config`
      - `id` (uuid, primary key)
      - `fee_type` (text, unique) - shop_supplies, park_fees, surcharge
      - `fee_name` (text) - Display name
      - `calculation_type` (text) - percentage, flat_amount
      - `default_value` (numeric) - Default rate or amount
      - `accounting_code_id` (uuid, foreign key) - Default accounting code
      - `is_active` (boolean) - Whether this fee is active
      - `description` (text, nullable) - Description of fee
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `quickbooks_settings`
      - `id` (uuid, primary key)
      - `company_name` (text) - Company name
      - `is_connected` (boolean) - Whether QB is connected
      - `access_token_encrypted` (text, nullable) - Encrypted access token
      - `refresh_token_encrypted` (text, nullable) - Encrypted refresh token
      - `realm_id` (text, nullable) - QuickBooks company ID
      - `last_sync_at` (timestamptz, nullable) - Last successful sync
      - `auto_export_enabled` (boolean) - Auto export invoices
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for master users
*/

CREATE TABLE IF NOT EXISTS quickbooks_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL CHECK (export_type IN ('estimate', 'work_order', 'invoice', 'payment')),
  entity_id uuid NOT NULL,
  entity_number text NOT NULL,
  export_status text DEFAULT 'pending' NOT NULL CHECK (export_status IN ('pending', 'success', 'error')),
  quickbooks_id text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  exported_by uuid REFERENCES user_profiles(user_id) NOT NULL,
  exported_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS estimate_fees_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type text UNIQUE NOT NULL CHECK (fee_type IN ('shop_supplies', 'park_fees', 'surcharge')),
  fee_name text NOT NULL,
  calculation_type text NOT NULL CHECK (calculation_type IN ('percentage', 'flat_amount')),
  default_value numeric(10, 4) DEFAULT 0 NOT NULL,
  accounting_code_id uuid REFERENCES accounting_codes(id),
  is_active boolean DEFAULT true NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS quickbooks_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  is_connected boolean DEFAULT false NOT NULL,
  access_token_encrypted text,
  refresh_token_encrypted text,
  realm_id text,
  last_sync_at timestamptz,
  auto_export_enabled boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qb_export_log_entity ON quickbooks_export_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_qb_export_log_type ON quickbooks_export_log(export_type);
CREATE INDEX IF NOT EXISTS idx_qb_export_log_status ON quickbooks_export_log(export_status);
CREATE INDEX IF NOT EXISTS idx_qb_export_log_date ON quickbooks_export_log(exported_at);

-- Enable RLS
ALTER TABLE quickbooks_export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_fees_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_settings ENABLE ROW LEVEL SECURITY;

-- Master users can view export logs
CREATE POLICY "Master users can view QB export log"
  ON quickbooks_export_log
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

CREATE POLICY "Master users can insert QB export log"
  ON quickbooks_export_log
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

-- Master users can manage fee config
CREATE POLICY "Master users can view fee config"
  ON estimate_fees_config
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

CREATE POLICY "Master users can insert fee config"
  ON estimate_fees_config
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

CREATE POLICY "Master users can update fee config"
  ON estimate_fees_config
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

-- Master users can manage QuickBooks settings
CREATE POLICY "Master users can view QB settings"
  ON quickbooks_settings
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

CREATE POLICY "Master users can insert QB settings"
  ON quickbooks_settings
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

CREATE POLICY "Master users can update QB settings"
  ON quickbooks_settings
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

-- Create triggers to update updated_at
CREATE OR REPLACE FUNCTION update_estimate_fees_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_fees_config_updated_at
  BEFORE UPDATE ON estimate_fees_config
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_fees_config_updated_at();

CREATE OR REPLACE FUNCTION update_quickbooks_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quickbooks_settings_updated_at
  BEFORE UPDATE ON quickbooks_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_settings_updated_at();

-- Insert default fee configurations
INSERT INTO estimate_fees_config (fee_type, fee_name, calculation_type, default_value, description)
VALUES 
  ('shop_supplies', 'Shop Supplies', 'percentage', 0.10, 'Shop supplies charged as percentage of parts/labor'),
  ('park_fees', 'National Park Fees', 'flat_amount', 0, 'Flat fee for national park access'),
  ('surcharge', 'Service Surcharge', 'percentage', 0, 'Additional service surcharge')
ON CONFLICT (fee_type) DO NOTHING;