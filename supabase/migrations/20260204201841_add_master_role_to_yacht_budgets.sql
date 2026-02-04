/*
  # Add Master Role Access to Yacht Budgets

  1. Overview
    - Adds master role to yacht_budgets RLS policies
    - Master role should have same access as staff (full access to all budgets)

  2. Changes
    - Add SELECT policy for master role
    - Add INSERT policy for master role
    - Add UPDATE policy for master role
    - Add DELETE policy for master role

  3. Security
    - Master role gets unrestricted access to all yacht budgets
    - Consistent with master role permissions elsewhere in the system
*/

-- Policy: Master can view all budgets
CREATE POLICY "Master can view all budgets"
  ON yacht_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policy: Master can insert budgets for any yacht
CREATE POLICY "Master can insert all budgets"
  ON yacht_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policy: Master can update all budgets
CREATE POLICY "Master can update all budgets"
  ON yacht_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policy: Master can delete budgets
CREATE POLICY "Master can delete budgets"
  ON yacht_budgets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );