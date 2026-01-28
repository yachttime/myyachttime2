/*
  # Fix Vessel Management Agreements Insert Policy - Correct Version

  1. Changes
    - Drop and recreate the INSERT policy for vessel_management_agreements
    - Properly reference the NEW row's yacht_id being inserted
    - Ensure owners can only insert agreements for their assigned yacht

  2. Security
    - Owners can insert agreements for their assigned yacht only
    - Must be authenticated
    - Must have owner role
    - The yacht_id being inserted must match their assigned yacht
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Owners can insert vessel agreements for their yacht" ON vessel_management_agreements;

-- Create the corrected INSERT policy
-- In WITH CHECK, we need to reference the columns of the row being inserted directly
CREATE POLICY "Owners can insert vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = vessel_management_agreements.yacht_id
      AND user_profiles.role = 'owner'
    )
  );