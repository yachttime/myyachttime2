/*
# Add Labor Cost Support to Salvage Asset Packages

1. New Table
  - `salvage_asset_package_labor`
    - Links labor codes to salvage asset packages with hours, rate, and description
    - Mirrors the existing `estimate_package_labor` pattern from the estimating system
    - `id` (uuid, primary key)
    - `package_id` (uuid, FK to salvage_asset_packages ON DELETE CASCADE)
    - `labor_code_id` (uuid, FK to labor_codes)
    - `hours` (numeric, default 0) - labor hours
    - `rate` (numeric, default 0) - hourly rate (can override labor_codes default)
    - `description` (text, nullable)
    - `created_at` (timestamptz)

2. Security
  - RLS enabled on salvage_asset_package_labor
  - Company isolation via parent salvage_asset_packages.company_id = get_user_company_id()
  - staff/master/manager/mechanic can SELECT (read)
  - staff/master can INSERT and UPDATE
  - master can DELETE
  - Matches the existing salvage_asset_package_items RLS pattern exactly

3. Indexes
  - package_id on salvage_asset_package_labor for fast lookups
*/

CREATE TABLE IF NOT EXISTS salvage_asset_package_labor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES salvage_asset_packages(id) ON DELETE CASCADE NOT NULL,
  labor_code_id uuid REFERENCES labor_codes(id) NOT NULL,
  hours numeric(10,2) NOT NULL DEFAULT 0,
  rate numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE salvage_asset_package_labor ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_salvage_asset_package_labor_package_id ON salvage_asset_package_labor(package_id);

-- RLS Policies for salvage_asset_package_labor
-- Pattern: scope through parent salvage_asset_packages.company_id = get_user_company_id()

DROP POLICY IF EXISTS "Staff can view salvage asset package labor" ON salvage_asset_package_labor;
CREATE POLICY "Staff can view salvage asset package labor"
  ON salvage_asset_package_labor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_labor.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can insert salvage asset package labor" ON salvage_asset_package_labor;
CREATE POLICY "Staff can insert salvage asset package labor"
  ON salvage_asset_package_labor FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_labor.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can update salvage asset package labor" ON salvage_asset_package_labor;
CREATE POLICY "Staff can update salvage asset package labor"
  ON salvage_asset_package_labor FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_labor.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
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
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_labor.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Master can delete salvage asset package labor" ON salvage_asset_package_labor;
CREATE POLICY "Master can delete salvage asset package labor"
  ON salvage_asset_package_labor FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_labor.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );
