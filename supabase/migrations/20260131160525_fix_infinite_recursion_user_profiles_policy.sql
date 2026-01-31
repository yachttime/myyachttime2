/*
  # Fix Infinite Recursion in User Profiles Policy

  1. Problem
    - The current policy creates infinite recursion by querying user_profiles from within the policy
    - This prevents users from viewing their profiles

  2. Solution
    - Use the is_staff() SECURITY DEFINER function to avoid recursion
    - Create a similar function to check if user is master
    - Simplify the policy to avoid self-referencing queries

  3. Security
    - Master role: Can view all profiles (including inactive)
    - Staff/Mechanic/Manager: Can view all active profiles
    - Regular users: Can only view their own profile
*/

-- Create a SECURITY DEFINER function to check if user is master (avoids RLS recursion)
CREATE OR REPLACE FUNCTION is_master()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'master'
  );
END;
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "User profiles select policy" ON public.user_profiles;

-- Create new policy using SECURITY DEFINER functions
CREATE POLICY "User profiles select policy"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own profile
    user_id = auth.uid()
    OR
    -- Master can see all profiles (no restrictions)
    is_master()
    OR
    -- Staff/mechanic/manager can see active profiles
    (is_staff() AND is_active = true)
  );
