/*
  # Add Master Role Access to Staff Schedules

  ## Overview
  Updates staff_schedules and staff_time_off_requests RLS policies to include the 'master' role.
  The master role should have full access to manage staff schedules and time-off requests.

  ## Changes
  1. **staff_schedules Policies**
     - Updated SELECT, INSERT, UPDATE, DELETE policies to include 'master' role
  
  2. **staff_time_off_requests Policies**
     - Updated SELECT, UPDATE, DELETE policies to include 'master' role

  ## Security Notes
  - Master role is the site administrator with unrestricted access
  - Staff role manages day-to-day operations
  - Mechanics can only view their own schedules/time-off
*/

-- =====================================================
-- Update staff_schedules policies
-- =====================================================

DROP POLICY IF EXISTS "Staff can view all schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can create schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can delete schedules" ON staff_schedules;

-- Staff and master can view all schedules
CREATE POLICY "Staff can view all schedules"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff and master can create schedules
CREATE POLICY "Staff can create schedules"
  ON staff_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff and master can update schedules
CREATE POLICY "Staff can update schedules"
  ON staff_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff and master can delete schedules
CREATE POLICY "Staff can delete schedules"
  ON staff_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- =====================================================
-- Update staff_time_off_requests policies
-- =====================================================

DROP POLICY IF EXISTS "Staff can view all time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Staff can update time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Staff can delete time off requests" ON staff_time_off_requests;

-- Staff and master can view all time off requests
CREATE POLICY "Staff can view all time off requests"
  ON staff_time_off_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff and master can update time off requests
CREATE POLICY "Staff can update time off requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff and master can delete time off requests
CREATE POLICY "Staff can delete time off requests"
  ON staff_time_off_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );