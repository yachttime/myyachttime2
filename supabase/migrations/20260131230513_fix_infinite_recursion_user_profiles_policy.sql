/*
  # Fix Infinite Recursion in User Profiles Policy

  The previous migration created an infinite recursion issue where the user_profiles
  SELECT policy was querying user_profiles itself to check roles.

  ## Solution
  Create a SECURITY DEFINER function that bypasses RLS to check user roles,
  then use that function in the policy instead of querying user_profiles directly.
*/

-- Create a security definer function to get current user's role without triggering RLS
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE user_id = auth.uid();
  
  RETURN user_role;
END;
$$;

-- Fix the user_profiles SELECT policy to avoid infinite recursion
DROP POLICY IF EXISTS "User profiles select policy" ON user_profiles;
CREATE POLICY "User profiles select policy" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    get_current_user_role() IN ('master', 'staff', 'mechanic')
  );

-- Update the user_profiles UPDATE policy as well
DROP POLICY IF EXISTS "Users can update own profile and staff can update all" ON user_profiles;
CREATE POLICY "Users can update own profile and staff can update all" ON user_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    get_current_user_role() IN ('master', 'staff')
  );