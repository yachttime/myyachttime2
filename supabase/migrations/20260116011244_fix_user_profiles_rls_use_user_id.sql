/*
  # Fix User Profiles RLS Policies

  1. Problem
    - Current policies check `id = auth.uid()` but the auth user ID is stored in `user_id` column
    - This prevents users from reading their own profiles
  
  2. Solution
    - Update all policies to use `user_id = auth.uid()` instead of `id = auth.uid()`
    - Maintain staff access for administrative functions
  
  3. Security
    - Users can view and update their own profile
    - Staff can view and update all profiles
    - Only users can insert their own profile
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can update user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Recreate policies with correct column reference
CREATE POLICY "Users can view own profile and staff can view all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_staff());

CREATE POLICY "Users can update own profile and staff can update all"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_staff())
  WITH CHECK (user_id = auth.uid() OR is_staff());

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
