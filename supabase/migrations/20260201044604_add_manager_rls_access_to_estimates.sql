/*
  # Add Manager RLS Access to Estimates

  1. Changes
    - Add RLS policies for managers to view, insert, update, and delete estimates
    - Managers with can_approve_repairs permission can access estimates
  
  2. Security
    - Managers must have can_approve_repairs = true to access estimates
    - Existing master role policies remain unchanged
*/

-- Allow managers with approval permission to view estimates
CREATE POLICY "Managers with repair approval can view estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

-- Allow managers with approval permission to insert estimates
CREATE POLICY "Managers with repair approval can insert estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

-- Allow managers with approval permission to update estimates
CREATE POLICY "Managers with repair approval can update estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

-- Allow managers with approval permission to delete estimates
CREATE POLICY "Managers with repair approval can delete estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );
