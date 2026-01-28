/*
  # Modify appointments table to use yacht name instead of yacht_id

  1. Changes
    - Drop existing policies that reference yacht_id
    - Drop foreign key constraint on yacht_id
    - Change yacht_id column to text type and rename to yacht_name
    - Recreate policies with updated logic

  2. Notes
    - This allows staff to enter yacht names as text without requiring a yacht ID
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Staff can create appointments" ON appointments;
DROP POLICY IF EXISTS "Staff and managers can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Users can view appointments for their yacht" ON appointments;
DROP POLICY IF EXISTS "Staff can update appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can delete appointments" ON appointments;

-- Drop the foreign key constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_yacht_id_fkey;

-- Rename and change the column type
ALTER TABLE appointments RENAME COLUMN yacht_id TO yacht_name;
ALTER TABLE appointments ALTER COLUMN yacht_name TYPE text USING yacht_name::text;
ALTER TABLE appointments ALTER COLUMN yacht_name SET DEFAULT '';

-- Recreate policies
CREATE POLICY "Staff can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff and managers can view all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff can update appointments"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff can delete appointments"
  ON appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );