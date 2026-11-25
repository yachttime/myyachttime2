/*
# Restrict Salvage Division read access from managers

1. Purpose
- Owners and managers must not see the Salvage Division. The admin menu and view
  routing were already tightened in the app; this migration enforces the same rule
  in the database so a manager cannot read salvage rows through the data API.

2. Modified policies (SELECT only; write policies were already staff/master-only)
- `salvage_reports`: "Staff can view company salvage reports" — removed 'manager'
  from the allowed role list (now staff, master, mechanic).
- `salvage_report_media`: "Staff can view salvage report media" — removed 'manager'.
- `salvage_assets`: "Staff can view company salvage assets" — removed 'manager'.
- `salvage_asset_packages`: "Staff can view company salvage asset packages" — removed 'manager'.
- `salvage_asset_package_items`: "Staff can view salvage asset package items" — removed 'manager'.
- `salvage_asset_package_labor`: "Staff can view salvage asset package labor" — removed 'manager'.

3. Security
- Owners were never granted salvage read access and remain excluded.
- Masters, staff, and mechanics keep their existing company-scoped read access.
- No grants or columns change; only the SELECT policy predicates are re-created.
*/

-- salvage_reports
DROP POLICY IF EXISTS "Staff can view company salvage reports" ON salvage_reports;
CREATE POLICY "Staff can view company salvage reports"
  ON salvage_reports FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'mechanic')
      AND user_profiles.is_active = true
    )
  );

-- salvage_report_media
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
        AND user_profiles.role IN ('staff', 'master', 'mechanic')
        AND user_profiles.is_active = true
      )
    )
  );

-- salvage_assets
DROP POLICY IF EXISTS "Staff can view company salvage assets" ON salvage_assets;
CREATE POLICY "Staff can view company salvage assets"
  ON salvage_assets FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'mechanic')
      AND user_profiles.is_active = true
    )
  );

-- salvage_asset_packages
DROP POLICY IF EXISTS "Staff can view company salvage asset packages" ON salvage_asset_packages;
CREATE POLICY "Staff can view company salvage asset packages"
  ON salvage_asset_packages FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'mechanic')
      AND user_profiles.is_active = true
    )
  );

-- salvage_asset_package_items
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
        AND user_profiles.role IN ('staff', 'master', 'mechanic')
        AND user_profiles.is_active = true
      )
    )
  );

-- salvage_asset_package_labor
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
        AND user_profiles.role IN ('staff', 'master', 'mechanic')
        AND user_profiles.is_active = true
      )
    )
  );
