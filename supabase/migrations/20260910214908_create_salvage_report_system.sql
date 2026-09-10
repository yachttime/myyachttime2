/*
  # Create Salvage Service Report System

  1. New Tables
    - `salvage_reports`
      - `id` (uuid, primary key)
      - `report_number` (text, unique) - Auto-generated report number (SAL-0001)
      - `estimate_id` (uuid, foreign key to estimates) - Links to approved estimate
      - `company_id` (uuid, foreign key to companies) - Company isolation
      - `yacht_id` (uuid, nullable, foreign key to yachts) - Associated yacht
      - `vessel_name` (text, nullable) - Vessel name if no yacht linked
      - `owner_name` (text, nullable) - Yacht owner name
      - `owner_phone` (text, nullable) - Owner phone
      - `owner_email` (text, nullable) - Owner email
      - `owner_address` (text, nullable) - Owner mailing address
      - `insurance_company` (text, nullable) - Insurance company name
      - `policy_number` (text, nullable) - Insurance policy number
      - `claim_number` (text, nullable) - Insurance claim number
      - `adjuster_name` (text, nullable) - Insurance adjuster name
      - `adjuster_phone` (text, nullable) - Adjuster phone
      - `adjuster_email` (text, nullable) - Adjuster email
      - `date_of_loss` (date, nullable) - Date of the loss event
      - `date_of_service` (date, nullable) - Date services were performed
      - `gps_latitude` (text, nullable) - GPS latitude of vessel
      - `gps_longitude` (text, nullable) - GPS longitude of vessel
      - `vessel_depth` (text, nullable) - Depth of vessel underwater
      - `underwater_condition` (text, nullable) - Condition of unit underwater
      - `vessel_description_prior` (text, nullable) - Overall description of boat prior to loss
      - `diesel_gallons` (text, nullable) - Number of gallons of diesel fuel
      - `gas_gallons` (text, nullable) - Number of gallons of gasoline
      - `findings` (text, nullable) - Findings and notes from the estimate
      - `status` (text) - draft or complete
      - `created_by` (uuid, foreign key to user_profiles) - Who created the report
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `salvage_report_media`
      - `id` (uuid, primary key)
      - `salvage_report_id` (uuid, foreign key to salvage_reports ON DELETE CASCADE)
      - `media_type` (text) - 'photo_prior' or 'photo_loss' or 'video_loss'
      - `file_url` (text) - Public URL of the uploaded file
      - `file_name` (text) - Original file name
      - `caption` (text, nullable) - Optional caption
      - `created_at` (timestamptz)

  2. Storage
    - Create `salvage-media` storage bucket (public) for photos and videos

  3. Security
    - Enable RLS on both tables
    - Company-level isolation using get_user_company_id() for staff/master/manager roles
    - Only master and staff roles can manage salvage reports
    - Only master can delete reports

  4. Functions
    - generate_salvage_report_number() - Auto-generates SAL-0001 format numbers
*/

-- Create salvage_reports table
CREATE TABLE IF NOT EXISTS salvage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text UNIQUE NOT NULL,
  estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  yacht_id uuid REFERENCES yachts(id) ON DELETE SET NULL,
  vessel_name text,
  owner_name text,
  owner_phone text,
  owner_email text,
  owner_address text,
  insurance_company text,
  policy_number text,
  claim_number text,
  adjuster_name text,
  adjuster_phone text,
  adjuster_email text,
  date_of_loss date,
  date_of_service date,
  gps_latitude text,
  gps_longitude text,
  vessel_depth text,
  underwater_condition text,
  vessel_description_prior text,
  diesel_gallons text,
  gas_gallons text,
  findings text,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'complete')),
  created_by uuid REFERENCES user_profiles(user_id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create salvage_report_media table
CREATE TABLE IF NOT EXISTS salvage_report_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salvage_report_id uuid REFERENCES salvage_reports(id) ON DELETE CASCADE NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo_prior', 'photo_loss', 'video_loss')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salvage_reports_company_id ON salvage_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_salvage_reports_estimate_id ON salvage_reports(estimate_id);
CREATE INDEX IF NOT EXISTS idx_salvage_reports_status ON salvage_reports(status);
CREATE INDEX IF NOT EXISTS idx_salvage_report_media_report_id ON salvage_report_media(salvage_report_id);

-- Enable RLS
ALTER TABLE salvage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE salvage_report_media ENABLE ROW LEVEL SECURITY;

-- Salvage reports: company-isolated CRUD for staff/master
DROP POLICY IF EXISTS "Staff can view company salvage reports" ON salvage_reports;
CREATE POLICY "Staff can view company salvage reports"
  ON salvage_reports FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can insert company salvage reports" ON salvage_reports;
CREATE POLICY "Staff can insert company salvage reports"
  ON salvage_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can update company salvage reports" ON salvage_reports;
CREATE POLICY "Staff can update company salvage reports"
  ON salvage_reports FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Master can delete company salvage reports" ON salvage_reports;
CREATE POLICY "Master can delete company salvage reports"
  ON salvage_reports FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Salvage report media: company-isolated via parent report
DROP POLICY IF EXISTS "Staff can view salvage report media" ON salvage_report_media;
CREATE POLICY "Staff can view salvage report media"
  ON salvage_report_media FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_reports
      WHERE salvage_reports.id = salvage_report_media.salvage_report_id
      AND salvage_reports.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can insert salvage report media" ON salvage_report_media;
CREATE POLICY "Staff can insert salvage report media"
  ON salvage_report_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM salvage_reports
      WHERE salvage_reports.id = salvage_report_media.salvage_report_id
      AND salvage_reports.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can update salvage report media" ON salvage_report_media;
CREATE POLICY "Staff can update salvage report media"
  ON salvage_report_media FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_reports
      WHERE salvage_reports.id = salvage_report_media.salvage_report_id
      AND salvage_reports.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM salvage_reports
      WHERE salvage_reports.id = salvage_report_media.salvage_report_id
      AND salvage_reports.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Master can delete salvage report media" ON salvage_report_media;
CREATE POLICY "Master can delete salvage report media"
  ON salvage_report_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_reports
      WHERE salvage_reports.id = salvage_report_media.salvage_report_id
      AND salvage_reports.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'master'
        AND user_profiles.is_active = true
      )
    )
  );

-- Also allow staff to delete media (they need to remove uploaded photos)
-- We need a separate policy for staff delete
DROP POLICY IF EXISTS "Staff can delete salvage report media" ON salvage_report_media;
CREATE POLICY "Staff can delete salvage report media"
  ON salvage_report_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_reports
      WHERE salvage_reports.id = salvage_report_media.salvage_report_id
      AND salvage_reports.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

-- Update trigger for salvage_reports
CREATE OR REPLACE FUNCTION update_salvage_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salvage_reports_updated_at ON salvage_reports;
CREATE TRIGGER salvage_reports_updated_at
  BEFORE UPDATE ON salvage_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_salvage_reports_updated_at();

-- Function to generate salvage report number
CREATE OR REPLACE FUNCTION generate_salvage_report_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM salvage_reports
  WHERE report_number ~ '^SAL-[0-9]+$';
  
  new_number := 'SAL-' || LPAD(next_num::text, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create storage bucket for salvage media (photos and videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('salvage-media', 'salvage-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for salvage-media bucket
DROP POLICY IF EXISTS "Staff can upload salvage media" ON storage.objects;
CREATE POLICY "Staff can upload salvage media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'salvage-media'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Authenticated can read salvage media" ON storage.objects;
CREATE POLICY "Authenticated can read salvage media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'salvage-media'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can delete salvage media" ON storage.objects;
CREATE POLICY "Staff can delete salvage media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'salvage-media'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );
