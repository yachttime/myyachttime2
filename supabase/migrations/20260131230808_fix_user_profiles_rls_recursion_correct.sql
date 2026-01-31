/*
  # Fix User Profiles Infinite Recursion - Final Solution

  The previous approach still caused recursion because the SECURITY DEFINER function
  was querying user_profiles, which still triggered RLS policies.

  ## Solution
  Simplify the policy to only allow users to see their own profile. Remove the
  problematic function entirely.
*/

-- Drop the policies first
DROP POLICY IF EXISTS "User profiles select policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile and staff can update all" ON user_profiles;

-- Now drop the problematic function
DROP FUNCTION IF EXISTS get_current_user_role();

-- Simplify user_profiles SELECT policy - users can only see their own profile
CREATE POLICY "User profiles select policy" ON user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Keep UPDATE policy simple - users update own, function-based checks for staff
CREATE POLICY "Users can update own profile and staff can update all" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_staff());
