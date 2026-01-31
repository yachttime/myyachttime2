/*
  # Add missing SELECT policy for user_profiles

  1. Problem
    - RLS is enabled on user_profiles table
    - Only INSERT policy exists
    - Users cannot read their own profile data, causing auth to fail
  
  2. Solution
    - Add SELECT policy allowing users to read their own profile
    - Add SELECT policy allowing staff/mechanic roles to read all profiles
  
  3. Security
    - Users can only read their own profile (auth.uid() = user_id)
    - Staff and mechanics can read all profiles (for user management features)
*/

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow staff and mechanics to read all profiles for management features
CREATE POLICY "Staff can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'master')
    )
  );
