/*
  # Add Staff and Mechanic Read Access to Estimating Tables

  ## Summary
  Grants SELECT access to staff and mechanic roles on the core estimating tables
  that previously only allowed master (and some manager) access.

  ## Changes
  - `estimate_tasks`: Add SELECT policy for staff and mechanic roles
  - `estimate_line_items`: Add SELECT policy for staff and mechanic roles
  - `estimating_invoices`: Add SELECT policy for staff and mechanic roles
  - `parts_inventory`: Add SELECT policy for staff and mechanic roles

  ## Notes
  - Staff get full read access (they already have write access via existing policies)
  - Mechanic get read access only (view-only enforcement is handled at the UI layer)
  - All policies are scoped to the user's company via get_user_company_id()
*/

CREATE POLICY "Staff and mechanic can view company estimate tasks"
  ON estimate_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_tasks.company_id
    )
  );

CREATE POLICY "Staff and mechanic can view company estimate line items"
  ON estimate_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_line_items.company_id
    )
  );

CREATE POLICY "Staff and mechanic can view company estimating invoices"
  ON estimating_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimating_invoices.company_id
    )
  );

CREATE POLICY "Staff and mechanic can view company parts inventory"
  ON parts_inventory FOR SELECT
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
