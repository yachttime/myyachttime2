/*
  # Add Master Role Access to Appointments Table

  1. Changes
    - Drop existing RLS policies for appointments table
    - Recreate policies with 'master' role included
    - Ensures master role has full CRUD access to appointments

  2. Security
    - Master role gets full access to create, read, update, and delete appointments
    - Staff, manager, and mechanic roles maintain their existing access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can create appointments" ON appointments;
DROP POLICY IF EXISTS "Staff and managers can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can update appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can delete appointments" ON appointments;

-- Recreate policies with master role included
CREATE POLICY "Staff and master can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff, managers, and master can view all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff and master can update appointments"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff and master can delete appointments"
  ON appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );
