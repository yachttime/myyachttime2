/*
  # Fix Staff Schedules Duplicate Policies

  1. Issues Fixed
    - Remove duplicate and conflicting RLS policies on staff_schedules table
    - Consolidate into clear, non-conflicting policies
    - Ensure staff, mechanics, and master roles can manage all schedules
    - Ensure users can view their own schedules

  2. Changes
    - Drop all existing policies on staff_schedules
    - Create new consolidated policies with clear permissions
    - Staff, mechanics, and master can INSERT, UPDATE, DELETE any schedule
    - All users can SELECT their own schedules
    - Staff, mechanics, and master can SELECT all schedules

  3. Security
    - Maintains RLS protection
    - Clear separation of permissions by role
    - No conflicting WITH CHECK clauses
*/

-- Drop all existing policies on staff_schedules
DROP POLICY IF EXISTS "Staff and master can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can create schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can delete schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff can view all schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff, mechanics, and master can delete schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff, mechanics, and master can insert schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Users can view own schedule" ON staff_schedules;
DROP POLICY IF EXISTS "Users can view own schedules" ON staff_schedules;

-- Create new consolidated policies

-- SELECT: Users can view their own schedules
CREATE POLICY "Users can view own schedules"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT: Staff, mechanics, and master can view all schedules
CREATE POLICY "Staff can view all schedules"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- INSERT: Staff, mechanics, and master can create schedules for anyone
CREATE POLICY "Staff can create schedules"
  ON staff_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- UPDATE: Staff, mechanics, and master can update any schedule
CREATE POLICY "Staff can update schedules"
  ON staff_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- DELETE: Staff, mechanics, and master can delete any schedule
CREATE POLICY "Staff can delete schedules"
  ON staff_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );
