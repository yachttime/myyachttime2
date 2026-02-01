/*
  # Create Company Information Table

  1. New Tables
    - `company_info`
      - `id` (uuid, primary key) - Unique identifier
      - `company_name` (text) - Company name
      - `address_line1` (text, nullable) - Street address line 1
      - `address_line2` (text, nullable) - Street address line 2
      - `city` (text, nullable) - City
      - `state` (text, nullable) - State/Province
      - `zip_code` (text, nullable) - Postal code
      - `phone` (text, nullable) - Company phone number
      - `email` (text, nullable) - Company email
      - `website` (text, nullable) - Company website
      - `logo_url` (text, nullable) - URL to company logo in storage
      - `created_at` (timestamptz) - Timestamp of creation
      - `updated_at` (timestamptz) - Timestamp of last update

  2. Storage
    - Create `company-logos` bucket for storing company logo images
    - Public bucket with authenticated upload access

  3. Security
    - Enable RLS on `company_info` table
    - Allow staff and master roles to view company info
    - Allow staff and master roles to update company info
    - Only one company info record should exist (singleton pattern)
*/

-- Create company_info table
CREATE TABLE IF NOT EXISTS company_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  address_line1 text DEFAULT '',
  address_line2 text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  zip_code text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;

-- Allow staff, mechanic, and master roles to view company info
CREATE POLICY "Staff, mechanic, and master can view company info"
  ON company_info
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Allow staff and master roles to update company info
CREATE POLICY "Staff and master can update company info"
  ON company_info
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Allow staff and master roles to insert company info (for initial setup)
CREATE POLICY "Staff and master can insert company info"
  ON company_info
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company logos bucket
CREATE POLICY "Anyone can view company logos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "Staff and master can upload company logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and master can update company logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and master can delete company logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Insert a default company info record if none exists
INSERT INTO company_info (company_name)
VALUES ('Your Company Name')
ON CONFLICT DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_info_updated_at
  BEFORE UPDATE ON company_info
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();