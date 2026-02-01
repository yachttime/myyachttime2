/*
  # Add missing RLS policies for repair_requests table

  ## Problem
  - repair_requests table only has an INSERT policy
  - Users and staff cannot view, update, or delete repair requests
  - This prevents the repair requests from showing up in the UI

  ## Changes
  1. Add SELECT policy
    - Users can view their own repair requests
    - Staff, mechanic, manager, and master can view all repair requests
  
  2. Add UPDATE policy
    - Users can update their own pending repair requests
    - Staff, mechanic, manager, and master can update all repair requests
  
  3. Add DELETE policy
    - Staff, mechanic, manager, and master can delete repair requests

  ## Security
  - Maintains proper access control
  - Users can only modify their own pending requests
  - Staff roles have full access for management
*/

-- Add SELECT policy for repair requests
CREATE POLICY "Users and staff can view repair requests"
  ON repair_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own repair requests
    submitted_by = auth.uid()
    OR
    -- Staff, mechanics, managers, and master can see all
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager', 'master')
    )
  );

-- Add UPDATE policy for repair requests
CREATE POLICY "Users and staff can update repair requests"
  ON repair_requests
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own pending requests
    (submitted_by = auth.uid() AND status = 'pending')
    OR
    -- Staff, mechanics, managers, and master can update all
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager', 'master')
    )
  )
  WITH CHECK (
    -- Same conditions for the updated data
    (submitted_by = auth.uid() AND status = 'pending')
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager', 'master')
    )
  );

-- Add DELETE policy for repair requests
CREATE POLICY "Staff can delete repair requests"
  ON repair_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager', 'master')
    )
  );