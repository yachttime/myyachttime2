/*
  # Add staff insert/update/delete policies for estimate_tasks

  ## Problem
  Staff users (e.g. Levi Kleck) can create and edit estimates but are blocked
  from saving because they cannot insert/update/delete rows in the
  estimate_tasks table. Only master and manager (with repair approval) had
  those permissions, while staff only had SELECT.

  ## Changes
  - Add INSERT policy for staff on estimate_tasks (company-scoped)
  - Add UPDATE policy for staff on estimate_tasks (company-scoped)
  - Add DELETE policy for staff on estimate_tasks (company-scoped)
*/

CREATE POLICY "Staff can insert company estimate tasks"
  ON estimate_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_tasks.company_id
    )
  );

CREATE POLICY "Staff can update company estimate tasks"
  ON estimate_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_tasks.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimate_tasks.company_id
    )
  );

CREATE POLICY "Staff can delete company estimate tasks"
  ON estimate_tasks
  FOR DELETE
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
