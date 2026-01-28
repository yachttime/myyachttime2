/*
  # Allow Staff and Manager to View and Update User Profiles

  1. Changes
    - Add policy for staff and manager roles to view all user profiles
    - Add policy for staff and manager roles to update user profiles
    - These policies use the existing is_staff() function which checks for staff, manager, and mechanic roles
  
  2. Security
    - Only authenticated users with staff or manager roles can view and update profiles
    - Uses existing is_staff() helper function for role checking
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff and managers can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Staff and managers can update user profiles" ON user_profiles;

-- Allow staff and manager to view all user profiles
CREATE POLICY "Staff and managers can view all user profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (is_staff());

-- Allow staff and manager to update user profiles
CREATE POLICY "Staff and managers can update user profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());
