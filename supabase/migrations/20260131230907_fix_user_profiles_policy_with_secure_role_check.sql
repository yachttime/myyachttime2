/*
  # Fix User Profiles Policy with Secure Role Check

  Create a properly configured SECURITY DEFINER function that bypasses RLS
  when checking roles, then update the user_profiles policy to use it.

  The key is to ensure the function has proper search_path set and explicit
  permissions to bypass RLS.
*/

-- First, ensure is_staff() has proper configuration
DROP FUNCTION IF EXISTS is_staff() CASCADE;
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  is_staff_member boolean;
BEGIN
  -- Query user_profiles directly - SECURITY DEFINER bypasses RLS
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'manager', 'mechanic', 'master')
    AND is_active = true
  ) INTO is_staff_member;
  
  RETURN COALESCE(is_staff_member, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

-- Recreate user_profiles policies
DROP POLICY IF EXISTS "User profiles select policy" ON user_profiles;
CREATE POLICY "User profiles select policy" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR is_staff()
  );

DROP POLICY IF EXISTS "Users can update own profile and staff can update all" ON user_profiles;
CREATE POLICY "Users can update own profile and staff can update all" ON user_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() 
    OR is_staff()
  );
