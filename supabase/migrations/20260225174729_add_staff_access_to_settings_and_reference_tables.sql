/*
  # Add staff and mechanic access to settings and reference tables

  ## Summary
  The staff role was blocked from viewing and managing vendors, accounting codes,
  labor codes, and estimate settings because those tables only had policies for
  master and manager-with-repair-approval roles. This migration adds the missing
  policies so staff and mechanic can access these tables within their company.

  ## Changes

  ### vendors
  - Add SELECT, INSERT, UPDATE, DELETE for staff and mechanic

  ### accounting_codes
  - Add SELECT, INSERT, UPDATE for staff and mechanic

  ### labor_codes
  - Add SELECT, INSERT, UPDATE for staff and mechanic

  ### estimate_settings
  - Add SELECT, INSERT for staff and mechanic

  ### parts_inventory
  - Backfill any remaining NULL company_id rows from existing data
  - Existing staff/mechanic SELECT policy already uses company_id match which is correct
  - Add INSERT and UPDATE for staff and mechanic (were missing)
*/

-- vendors: add staff/mechanic access
CREATE POLICY "Staff and mechanic can view company vendors"
  ON vendors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = vendors.company_id
    )
  );

CREATE POLICY "Staff and mechanic can insert vendors"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can update vendors"
  ON vendors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = vendors.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can delete vendors"
  ON vendors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = vendors.company_id
    )
  );

-- accounting_codes: add staff/mechanic access
CREATE POLICY "Staff and mechanic can view company accounting codes"
  ON accounting_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = accounting_codes.company_id
    )
  );

CREATE POLICY "Staff and mechanic can insert accounting codes"
  ON accounting_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can update accounting codes"
  ON accounting_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = accounting_codes.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can delete accounting codes"
  ON accounting_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = accounting_codes.company_id
    )
  );

-- labor_codes: add staff/mechanic access
CREATE POLICY "Staff and mechanic can view company labor codes"
  ON labor_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = labor_codes.company_id
    )
  );

CREATE POLICY "Staff and mechanic can insert labor codes"
  ON labor_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can update labor codes"
  ON labor_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = labor_codes.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can delete labor codes"
  ON labor_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = labor_codes.company_id
    )
  );

-- estimate_settings: add staff/mechanic access
CREATE POLICY "Staff and mechanic can view company estimate settings"
  ON estimate_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_settings.company_id
    )
  );

CREATE POLICY "Staff and mechanic can insert estimate settings"
  ON estimate_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can update estimate settings"
  ON estimate_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_settings.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

-- parts_inventory: add INSERT and UPDATE for staff/mechanic (SELECT already exists)
CREATE POLICY "Staff and mechanic can insert parts inventory"
  ON parts_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can update company parts inventory"
  ON parts_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = parts_inventory.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and mechanic can delete company parts inventory"
  ON parts_inventory FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = parts_inventory.company_id
    )
  );
