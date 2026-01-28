/*
  # Fix Infinite Recursion in RLS Policies

  1. Changes
    - Create helper functions to check user roles without triggering infinite recursion
    - Replace recursive policies with function-based policies
    - Ensures policies can safely check user roles without circular dependencies

  2. Security
    - Maintains same access control as before
    - Staff can view/manage all data
    - Users can view/manage their own data
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Staff can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Staff can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Staff can view all yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can insert yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can update yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can delete yachts" ON yachts;
DROP POLICY IF EXISTS "Owners and managers can view their yacht" ON yachts;

-- Create a function to check if user is staff (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = user_uuid AND role = 'staff'
  );
END;
$$;

-- Create new policies for user_profiles using the function
CREATE POLICY "Staff can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Staff can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (is_staff(auth.uid()) OR user_id = auth.uid());

-- Create new policies for yachts using the function
CREATE POLICY "Staff can view all yachts"
  ON yachts FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()) OR owner_id = auth.uid());

CREATE POLICY "Staff can insert yachts"
  ON yachts FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can update yachts"
  ON yachts FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can delete yachts"
  ON yachts FOR DELETE
  TO authenticated
  USING (is_staff(auth.uid()));