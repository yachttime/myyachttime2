/*
  # Fix Vessel Management Agreements Insert Policy

  1. Changes
    - Drop the existing insert policy that uses the helper function
    - Create a new policy that directly checks user_profiles table
    - This avoids potential issues with SECURITY DEFINER in RLS context

  2. Security
    - Ensures only owners can insert agreements for their yacht
    - Verifies submitted_by matches the authenticated user
    - Directly checks role and yacht_id in user_profiles
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Owners can insert vessel agreements for their yacht" ON vessel_management_agreements;

-- Create new insert policy with direct check
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