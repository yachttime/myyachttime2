/*
  # Fix Vessel Management Agreements RLS Policies

  The vessel_management_agreements table has RLS enabled but no policies exist,
  causing all inserts/updates to fail with 400 errors.

  This migration creates comprehensive RLS policies to allow:
  - Staff, managers, and master roles to insert agreements on behalf of yacht owners
  - Staff, managers, and master roles to update agreements
  - Owners to insert and update their own draft agreements
  - All authenticated users with yacht access to view agreements
*/

-- INSERT policy: staff, manager, master can insert agreements
CREATE POLICY "Staff and managers can insert vessel agreements"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'master')
    )
  );

-- INSERT policy: owners can insert agreements for their yacht
CREATE POLICY "Owners can insert vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = vessel_management_agreements.yacht_id
      AND user_profiles.role = 'owner'
    )
  );

-- SELECT policy: all authenticated users with access to the yacht can view
CREATE POLICY "Users can view vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND (
        user_profiles.yacht_id = vessel_management_agreements.yacht_id
        OR user_profiles.role IN ('staff', 'manager', 'master')
      )
    )
  );

-- UPDATE policy: staff, manager, master can update any agreement
CREATE POLICY "Staff and managers can update vessel agreements"
  ON vessel_management_agreements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'master')
    )
  );

-- UPDATE policy: owners can update their own draft agreements
CREATE POLICY "Owners can update their own draft vessel agreements"
  ON vessel_management_agreements
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- DELETE policy: owners can delete their own draft agreements
CREATE POLICY "Owners can delete their own draft vessel agreements"
  ON vessel_management_agreements
  FOR DELETE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- DELETE policy: staff and managers can delete agreements
CREATE POLICY "Staff and managers can delete vessel agreements"
  ON vessel_management_agreements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'master')
    )
  );
