/*
  # Create Company Settings Table

  1. New Tables
    - `company_settings` - Stores company-specific configuration settings
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `setting_key` (text) - Setting identifier
      - `setting_value` (jsonb) - Flexible JSON value storage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Setting Keys Examples
    - email_smtp_host, email_smtp_port, email_smtp_username, email_smtp_password
    - email_from_address, email_from_name
    - invoice_number_prefix, invoice_next_number
    - estimate_number_prefix, estimate_next_number
    - work_order_number_prefix, work_order_next_number
    - default_labor_rate, default_tax_rate
    - quickbooks_realm_id, quickbooks_access_token, quickbooks_refresh_token
    - stripe_publishable_key, stripe_secret_key
    - notification_email_enabled, notification_sms_enabled
    - branding_primary_color, branding_secondary_color
    - And many more...

  3. Security
    - Enable RLS
    - Master users can manage all company settings
    - Admin users can manage their own company settings
    - Regular users can read their company settings

  4. Helper Functions
    - `get_company_setting(company_uuid, setting_key)` - Get a specific setting value
    - `set_company_setting(company_uuid, setting_key, setting_value)` - Set a setting value
*/

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, setting_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_key ON company_settings(setting_key);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: Get a specific setting value for a company
CREATE OR REPLACE FUNCTION get_company_setting(
  company_uuid uuid,
  setting_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT setting_value
  FROM company_settings
  WHERE company_id = company_uuid AND setting_key = setting_key
  LIMIT 1;
$$;

-- Helper function: Set a specific setting value for a company
CREATE OR REPLACE FUNCTION set_company_setting(
  company_uuid uuid,
  setting_key text,
  setting_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO company_settings (company_id, setting_key, setting_value)
  VALUES (company_uuid, setting_key, setting_value)
  ON CONFLICT (company_id, setting_key)
  DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = now();
END;
$$;

-- RLS Policies

-- Master users can view all company settings
CREATE POLICY "Master users can view all company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (is_master_user());

-- Users can view their own company settings
CREATE POLICY "Users can view their company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- Master users can insert company settings
CREATE POLICY "Master users can insert company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_master_user());

-- Admin users can insert their own company settings
CREATE POLICY "Admin users can insert their company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND
    user_has_permission('manage_company_settings')
  );

-- Master users can update any company settings
CREATE POLICY "Master users can update company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (is_master_user())
  WITH CHECK (is_master_user());

-- Admin users can update their own company settings
CREATE POLICY "Admin users can update their company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    user_has_permission('manage_company_settings')
  )
  WITH CHECK (
    company_id = get_user_company_id() AND
    user_has_permission('manage_company_settings')
  );

-- Master users can delete company settings
CREATE POLICY "Master users can delete company settings"
  ON company_settings
  FOR DELETE
  TO authenticated
  USING (is_master_user());

-- Admin users can delete their own company settings
CREATE POLICY "Admin users can delete their company settings"
  ON company_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id() AND
    user_has_permission('manage_company_settings')
  );

-- Create updated_at trigger
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- Insert default settings for AZ Marine
DO $$
DECLARE
  az_marine_id uuid;
BEGIN
  SELECT id INTO az_marine_id FROM companies WHERE company_name = 'AZ Marine' LIMIT 1;
  
  IF az_marine_id IS NOT NULL THEN
    INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES
      (az_marine_id, 'invoice_number_prefix', '"INV-"'::jsonb),
      (az_marine_id, 'invoice_next_number', '1000'::jsonb),
      (az_marine_id, 'estimate_number_prefix', '"EST-"'::jsonb),
      (az_marine_id, 'estimate_next_number', '1000'::jsonb),
      (az_marine_id, 'work_order_number_prefix', '"WO-"'::jsonb),
      (az_marine_id, 'work_order_next_number', '1000'::jsonb),
      (az_marine_id, 'email_from_name', '"AZ Marine"'::jsonb),
      (az_marine_id, 'email_from_address', '"info@azmarine.com"'::jsonb),
      (az_marine_id, 'notification_email_enabled', 'true'::jsonb),
      (az_marine_id, 'notification_sms_enabled', 'false'::jsonb)
    ON CONFLICT (company_id, setting_key) DO NOTHING;
    
    RAISE NOTICE 'Created default settings for AZ Marine';
  END IF;
END $$;
