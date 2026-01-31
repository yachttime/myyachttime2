/*
  # Fix Master Role to View All User Profiles

  1. Changes
    - Drop existing "Staff can view all profiles" policy
    - Recreate with explicit check that ensures master role can see ALL users
    - Ensures no filtering happens at database level for master role

  2. Security
    - Master role: Can view ALL user profiles (including inactive)
    - Staff/Mechanic roles: Can view ALL active user profiles  
    - Regular users: Can only view their own profile
*/

-- Drop and recreate the staff view policy
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.user_profiles;

CREATE POLICY "Staff can view all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- If user is master, show everything
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'master'
    )
    OR
    -- If user is staff/mechanic, show all active users
    (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.user_id = auth.uid()
        AND up.role IN ('staff', 'mechanic', 'manager')
        AND is_active = true
      )
      AND user_profiles.is_active = true
    )
  );
