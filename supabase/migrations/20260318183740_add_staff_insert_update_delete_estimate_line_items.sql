/*
  # Add Staff Insert/Update/Delete Policies for Estimate Line Items

  ## Problem
  Staff users (like Levi) can only SELECT estimate_line_items but cannot INSERT, UPDATE, or DELETE.
  This causes an RLS violation when saving an estimate.

  ## Changes
  - Add INSERT policy for staff/mechanic on estimate_line_items (company-scoped)
  - Add UPDATE policy for staff/mechanic on estimate_line_items (company-scoped)
  - Add DELETE policy for staff/mechanic on estimate_line_items (company-scoped)
*/

CREATE POLICY "Staff and mechanic can insert company estimate line items"
  ON estimate_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_line_items.company_id
    )
  );

CREATE POLICY "Staff and mechanic can update company estimate line items"
  ON estimate_line_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_line_items.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_line_items.company_id
    )
  );

CREATE POLICY "Staff and mechanic can delete company estimate line items"
  ON estimate_line_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_line_items.company_id
    )
  );
