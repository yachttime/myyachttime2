/*
  # Restrict Staff Calendar to Staff and Mechanics Only

  1. Changes
    - Drop existing RLS policies that allow manager access
    - Create new policies that only allow staff and mechanic roles
    - Managers and owners will no longer have access to view or manage time-off requests

  2. Security
    - Only staff can view all requests and approve/reject them
    - Mechanics can only view and manage their own requests
    - Managers and owners are completely restricted from this system
*/

-- Drop existing policies for staff_time_off_requests
DROP POLICY IF EXISTS "Staff can view all time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Staff can update time off requests" ON staff_time_off_requests;
DROP POLICY IF EXISTS "Staff can delete time off requests" ON staff_time_off_requests;

-- Drop existing policies for staff_schedules
DROP POLICY IF EXISTS "Staff can view all schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can create schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can delete schedules" ON staff_schedules;

-- Recreate policies with staff-only access

-- staff_time_off_requests policies
CREATE POLICY "Staff can view all time off requests"
  ON staff_time_off_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can update time off requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can delete time off requests"
  ON staff_time_off_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- staff_schedules policies
CREATE POLICY "Staff can view all schedules"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can create schedules"
  ON staff_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can update schedules"
  ON staff_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can delete schedules"
  ON staff_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );