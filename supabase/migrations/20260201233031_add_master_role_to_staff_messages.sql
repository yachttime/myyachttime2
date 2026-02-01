/*
  # Add Master Role to Staff Messages RLS Policies

  ## Summary
  Updates all RLS policies on staff_messages table to include 'master' role
  so that master users can view, create, update, and delete staff messages.

  ## Changes Made
  - Drop and recreate all policies with 'master' role included
  - Policies affected: SELECT, INSERT, UPDATE, DELETE

  ## Security
  - Master, staff, managers, and mechanics can view all staff messages
  - Master, staff, managers, and mechanics can update/delete staff messages
  - All authenticated users can create staff messages
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Staff and managers can view all staff messages" ON staff_messages;
DROP POLICY IF EXISTS "Authenticated users can create staff messages" ON staff_messages;
DROP POLICY IF EXISTS "Staff can update staff messages" ON staff_messages;
DROP POLICY IF EXISTS "Staff can delete staff messages" ON staff_messages;

-- Recreate with master role included
CREATE POLICY "Staff and managers can view all staff messages"
  ON staff_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );

CREATE POLICY "Authenticated users can create staff messages"
  ON staff_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Staff can update staff messages"
  ON staff_messages
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

CREATE POLICY "Staff can delete staff messages"
  ON staff_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );
