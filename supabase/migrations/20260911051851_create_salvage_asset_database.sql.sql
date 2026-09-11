/*
# Create Salvage Asset Database System

1. New Tables
  - `salvage_assets`
    - Individual reusable salvage assets with cost (e.g. pumps, air bags, dive gear, fuel)
    - `id` (uuid, primary key)
    - `company_id` (uuid, FK to companies) - company isolation
    - `name` (text, not null) - asset name
    - `category` (text, nullable) - grouping category
    - `description` (text, nullable) - detailed description
    - `unit_cost` (numeric, default 0) - cost per unit
    - `is_active` (boolean, default true)
    - `created_by` (uuid, FK to user_profiles)
    - `created_at` (timestamptz)

  - `salvage_asset_packages`
    - Named bundles of assets (e.g. "Recovery Package", "Fuel Spill Cleanup Package")
    - `id` (uuid, primary key)
    - `company_id` (uuid, FK to companies) - company isolation
    - `name` (text, not null) - package name
    - `description` (text, nullable)
    - `is_active` (boolean, default true)
    - `created_by` (uuid, FK to user_profiles)
    - `created_at` (timestamptz)

  - `salvage_asset_package_items`
    - Links assets to packages with quantity and optional price override
    - `id` (uuid, primary key)
    - `package_id` (uuid, FK to salvage_asset_packages ON DELETE CASCADE)
    - `asset_id` (uuid, FK to salvage_assets)
    - `quantity` (numeric, default 1)
    - `unit_price` (numeric, nullable - overrides asset unit_cost when set)
    - `created_at` (timestamptz)

2. Security
  - RLS enabled on all tables
  - Company isolation via get_user_company_id()
  - staff/master/manager/mechanic can SELECT (read)
  - staff/master can INSERT and UPDATE
  - only master can DELETE
  - Matches existing salvage_reports RLS pattern

3. Indexes
  - company_id on all tables
  - package_id on package_items
  - is_active on assets and packages
*/

-- Create salvage_assets table
CREATE TABLE IF NOT EXISTS salvage_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES user_profiles(user_id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create salvage_asset_packages table
CREATE TABLE IF NOT EXISTS salvage_asset_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES user_profiles(user_id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create salvage_asset_package_items table
CREATE TABLE IF NOT EXISTS salvage_asset_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES salvage_asset_packages(id) ON DELETE CASCADE NOT NULL,
  asset_id uuid REFERENCES salvage_assets(id) ON DELETE CASCADE NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE salvage_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE salvage_asset_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE salvage_asset_package_items ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salvage_assets_company_id ON salvage_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_salvage_assets_is_active ON salvage_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_salvage_asset_packages_company_id ON salvage_asset_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_salvage_asset_packages_is_active ON salvage_asset_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_salvage_asset_package_items_package_id ON salvage_asset_package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_salvage_asset_package_items_asset_id ON salvage_asset_package_items(asset_id);

-- Update triggers
CREATE OR REPLACE FUNCTION update_salvage_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salvage_assets_updated_at ON salvage_assets;
CREATE TRIGGER salvage_assets_updated_at
  BEFORE UPDATE ON salvage_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_salvage_assets_updated_at();

CREATE OR REPLACE FUNCTION update_salvage_asset_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salvage_asset_packages_updated_at ON salvage_asset_packages;
CREATE TRIGGER salvage_asset_packages_updated_at
  BEFORE UPDATE ON salvage_asset_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_salvage_asset_packages_updated_at();

-- ============ RLS POLICIES ============

-- ---- salvage_assets ----
DROP POLICY IF EXISTS "Staff can view company salvage assets" ON salvage_assets;
CREATE POLICY "Staff can view company salvage assets"
  ON salvage_assets FOR SELECT
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

DROP POLICY IF EXISTS "Staff can insert company salvage assets" ON salvage_assets;
CREATE POLICY "Staff can insert company salvage assets"
  ON salvage_assets FOR INSERT
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

DROP POLICY IF EXISTS "Staff can update company salvage assets" ON salvage_assets;
CREATE POLICY "Staff can update company salvage assets"
  ON salvage_assets FOR UPDATE
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

DROP POLICY IF EXISTS "Master can delete company salvage assets" ON salvage_assets;
CREATE POLICY "Master can delete company salvage assets"
  ON salvage_assets FOR DELETE
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

-- ---- salvage_asset_packages ----
DROP POLICY IF EXISTS "Staff can view company salvage asset packages" ON salvage_asset_packages;
CREATE POLICY "Staff can view company salvage asset packages"
  ON salvage_asset_packages FOR SELECT
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

DROP POLICY IF EXISTS "Staff can insert company salvage asset packages" ON salvage_asset_packages;
CREATE POLICY "Staff can insert company salvage asset packages"
  ON salvage_asset_packages FOR INSERT
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

DROP POLICY IF EXISTS "Staff can update company salvage asset packages" ON salvage_asset_packages;
CREATE POLICY "Staff can update company salvage asset packages"
  ON salvage_asset_packages FOR UPDATE
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

DROP POLICY IF EXISTS "Master can delete company salvage asset packages" ON salvage_asset_packages;
CREATE POLICY "Master can delete company salvage asset packages"
  ON salvage_asset_packages FOR DELETE
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

-- ---- salvage_asset_package_items ----
DROP POLICY IF EXISTS "Staff can view salvage asset package items" ON salvage_asset_package_items;
CREATE POLICY "Staff can view salvage asset package items"
  ON salvage_asset_package_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_items.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can insert salvage asset package items" ON salvage_asset_package_items;
CREATE POLICY "Staff can insert salvage asset package items"
  ON salvage_asset_package_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_items.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can update salvage asset package items" ON salvage_asset_package_items;
CREATE POLICY "Staff can update salvage asset package items"
  ON salvage_asset_package_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_items.package_id
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
      WHERE salvage_asset_packages.id = salvage_asset_package_items.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can delete salvage asset package items" ON salvage_asset_package_items;
CREATE POLICY "Staff can delete salvage asset package items"
  ON salvage_asset_package_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM salvage_asset_packages
      WHERE salvage_asset_packages.id = salvage_asset_package_items.package_id
      AND salvage_asset_packages.company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master')
        AND user_profiles.is_active = true
      )
    )
  );