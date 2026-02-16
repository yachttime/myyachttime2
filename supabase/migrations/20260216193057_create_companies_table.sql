/*
  # Create Companies Table - Multi-Tenant Foundation

  1. New Tables
    - `companies` - Core company information for multi-tenant isolation
      - `id` (uuid, primary key)
      - `company_name` (text, unique) - Display name
      - `legal_name` (text) - Full legal entity name
      - `address` (text) - Street address
      - `city` (text)
      - `state` (text)
      - `zip_code` (text)
      - `phone` (text)
      - `email` (text)
      - `website` (text)
      - `logo_url` (text) - Path to company logo
      - `timezone` (text) - Default: America/Phoenix
      - `default_tax_rate` (decimal) - Company default tax rate
      - `is_active` (boolean) - Company active status
      - `created_at` (timestamptz)
      - `created_by` (uuid) - References auth.users
      - `updated_at` (timestamptz)

  2. Initial Data
    - Insert AZ Marine as the first company

  3. Security
    - Enable RLS (policies will be added after helper functions are created)
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text UNIQUE NOT NULL,
  legal_name text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  website text,
  logo_url text,
  timezone text DEFAULT 'America/Phoenix' NOT NULL,
  default_tax_rate decimal(5,4) DEFAULT 0.0000,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Insert AZ Marine as the first company
INSERT INTO companies (
  company_name,
  legal_name,
  address,
  city,
  state,
  zip_code,
  phone,
  email,
  website,
  timezone,
  default_tax_rate,
  is_active
) VALUES (
  'AZ Marine',
  'AZ Marine LLC',
  '1234 Marina Way',
  'Phoenix',
  'AZ',
  '85001',
  '(602) 555-0100',
  'info@azmarine.com',
  'https://azmarine.com',
  'America/Phoenix',
  0.0840, -- 8.4% default tax rate for Arizona
  true
)
ON CONFLICT (company_name) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();
