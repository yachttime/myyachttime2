/*
  # Fix Missing RLS Policies on admin_notifications

  ## Overview
  Adds missing INSERT, UPDATE, and DELETE policies to admin_notifications table.
  These policies were supposed to be created by earlier migrations but are missing from the database.

  ## Changes
  
  1. **Policies Added**
     - INSERT policy: Staff can insert admin notifications
     - UPDATE policy: Staff can update admin notifications  
     - DELETE policy: Staff can delete admin notifications
  
  ## Security
  - All policies restricted to staff roles (staff, manager, mechanic, master)
  - Ensures staff can mark notifications as complete
  - Maintains data integrity and access control
*/

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Staff can insert admin notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Staff can update admin notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Staff can delete admin notifications" ON admin_notifications;

-- Create INSERT policy
CREATE POLICY "Staff can insert admin notifications"
  ON admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'manager', 'mechanic', 'master')
      AND is_active = true
    )
  );

-- Create UPDATE policy
CREATE POLICY "Staff can update admin notifications"
  ON admin_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'manager', 'mechanic', 'master')
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'manager', 'mechanic', 'master')
      AND is_active = true
    )
  );

-- Create DELETE policy
CREATE POLICY "Staff can delete admin notifications"
  ON admin_notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'manager', 'mechanic', 'master')
      AND is_active = true
    )
  );
