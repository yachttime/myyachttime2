/*
  # Fix Vessel Management Agreements Insert Policy

  1. Changes
    - Drop and recreate the INSERT policy for vessel_management_agreements
    - Fix the yacht_id check to properly reference the new row being inserted
    - Ensure owners can insert agreements for their assigned yachts

  2. Security
    - Owners can insert agreements for their assigned yacht
    - Must be authenticated
    - Must have owner role
    - yacht_id must match their assigned yacht
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Owners can insert vessel agreements for their yacht" ON vessel_management_agreements;

-- Create the corrected INSERT policy
CREATE POLICY "Owners can insert vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = yacht_id
      AND user_profiles.role = 'owner'
    )
  );