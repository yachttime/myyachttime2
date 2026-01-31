/*
  # Simplify Master Role Policy for User Profiles

  1. Changes
    - Simplify the SELECT policy to be more explicit
    - Master role sees everything with no conditions
    - Staff/mechanic see only active users
    - Regular users see their own profile

  2. Security
    - Master role: Complete unrestricted access to all profiles
    - Staff/Mechanic/Manager roles: Can view all active user profiles  
    - Regular users: Can only view their own profile
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;

-- Create single comprehensive SELECT policy
CREATE POLICY "User profiles select policy"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own profile
    user_id = auth.uid()
    OR
    -- Master role can see ALL profiles (no restrictions)
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'master'
    )
    OR
    -- Staff/mechanic/manager can see all ACTIVE profiles
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role IN ('staff', 'mechanic', 'manager')
      )
      AND is_active = true
    )
  );
