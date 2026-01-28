/*
  # Fix Vessel Management Agreements Insert Policy - Allow Staff/Manager

  1. Changes
    - Drop the existing insert policy that only allows owners
    - Create a new policy that allows owners, staff, and managers to insert agreements
    - Staff and managers can insert agreements for any yacht
    - Owners can only insert agreements for their assigned yacht

  2. Security
    - Authenticated users only
    - Owners: Can insert agreements for their assigned yacht only
    - Staff/Manager: Can insert agreements for any yacht
    - submitted_by must match the authenticated user
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Owners can insert vessel agreements for their yacht" ON vessel_management_agreements;

-- Create new insert policy that allows staff, managers, and owners
CREATE POLICY "Users can insert vessel agreements"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid() 
    AND (
      -- Staff and managers can insert for any yacht
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'manager', 'mechanic')
      )
      OR
      -- Owners can insert for their yacht only
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.yacht_id = vessel_management_agreements.yacht_id
        AND user_profiles.role = 'owner'
      )
    )
  );
