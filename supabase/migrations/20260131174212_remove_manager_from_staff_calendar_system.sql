/*
  # Remove Manager Role from Staff Calendar System

  1. Changes
    - Update all staff_time_off_requests policies to exclude 'manager' role
    - Update all staff_schedules policies to exclude 'manager' role
    - Update all staff_schedule_overrides policies to exclude 'manager' role
    - Managers are yacht owners who help manage yachts, not staff members
    - Only 'staff', 'mechanic', and 'master' roles should access staff calendar features

  2. Security
    - Restrict staff calendar system to actual staff members only
*/

-- ===================================
-- STAFF TIME OFF REQUESTS POLICIES
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view all time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Mechanics can view own time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Users can create own time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Staff can update time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Staff can delete time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Users can delete own pending requests" ON staff_time_off_requests;

-- Recreate policies without manager role

-- Staff and master can view all time-off requests
CREATE POLICY "Staff can view all time off requests"
  ON staff_time_off_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Mechanics can view their own time-off requests
CREATE POLICY "Mechanics can view own time off requests"
  ON staff_time_off_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff, mechanics, and master can insert their own requests
CREATE POLICY "Users can create own time off requests"
  ON staff_time_off_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'mechanic')
    )
  );

-- Only staff and master can update requests (for approval/rejection)
CREATE POLICY "Staff can update time off requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Staff and master can delete any request
CREATE POLICY "Staff can delete time off requests"
  ON staff_time_off_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Users can delete their own pending requests
CREATE POLICY "Users can delete own pending requests"
  ON staff_time_off_requests
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- ===================================
-- STAFF SCHEDULES POLICIES
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view all schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Users can view own schedule" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can create schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can delete schedules" ON staff_schedules;

-- Recreate policies without manager role

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
    )
  );

-- Mechanics can view their own schedule
CREATE POLICY "Users can view own schedule"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only staff and master can insert schedules
CREATE POLICY "Staff can create schedules"
  ON staff_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Only staff and master can update schedules
CREATE POLICY "Staff can update schedules"
  ON staff_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Only staff and master can delete schedules
CREATE POLICY "Staff can delete schedules"
  ON staff_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- ===================================
-- STAFF SCHEDULE OVERRIDES POLICIES
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff and master can view all schedule overrides" ON staff_schedule_overrides;
DROP POLICY IF EXISTS "Users can view own schedule overrides" ON staff_schedule_overrides;
DROP POLICY IF EXISTS "Staff and master can create schedule overrides" ON staff_schedule_overrides;
DROP POLICY IF EXISTS "Staff and master can update schedule overrides" ON staff_schedule_overrides;
DROP POLICY IF EXISTS "Staff and master can delete schedule overrides" ON staff_schedule_overrides;

-- Recreate policies without manager role

-- Staff and master can view all schedule overrides
CREATE POLICY "Staff and master can view all schedule overrides"
  ON staff_schedule_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Users can view their own schedule overrides
CREATE POLICY "Users can view own schedule overrides"
  ON staff_schedule_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only staff and master can create schedule overrides
CREATE POLICY "Staff and master can create schedule overrides"
  ON staff_schedule_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Only staff and master can update schedule overrides
CREATE POLICY "Staff and master can update schedule overrides"
  ON staff_schedule_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Only staff and master can delete schedule overrides
CREATE POLICY "Staff and master can delete schedule overrides"
  ON staff_schedule_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );