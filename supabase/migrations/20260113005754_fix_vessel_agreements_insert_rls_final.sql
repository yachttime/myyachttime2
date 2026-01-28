/*
  # Fix Vessel Management Agreements INSERT RLS Policy - Final Fix

  1. Changes
    - Create a helper function to check yacht ownership
    - Update INSERT policy to use the helper function
    - This avoids the table name ambiguity issue in WITH CHECK

  2. Security
    - Owners can only insert agreements for yachts they own
    - Must be authenticated
    - Must have owner role
*/

-- Create helper function to check if user owns a yacht
CREATE OR REPLACE FUNCTION user_owns_yacht(check_user_id uuid, check_yacht_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = check_user_id
    AND user_profiles.yacht_id = check_yacht_id
    AND user_profiles.role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Owners can insert vessel agreements for their yacht" ON vessel_management_agreements;

-- Create the corrected INSERT policy using the helper function
CREATE POLICY "Owners can insert vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND user_owns_yacht(auth.uid(), yacht_id)
  );