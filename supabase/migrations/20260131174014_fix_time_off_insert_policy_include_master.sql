/*
  # Fix Time Off Request Insert Policy - Include Master Role

  1. Changes
    - Drop existing INSERT policy for time-off requests
    - Recreate policy to include 'master' role
    - Master role users should be able to create their own time-off requests

  2. Security
    - Users can only create time-off requests for themselves
    - Must be staff, manager, mechanic, or master role
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create own time off requests" ON staff_time_off_requests;

-- Recreate with master role included
CREATE POLICY "Users can create own time off requests"
  ON staff_time_off_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );