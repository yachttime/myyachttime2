/*
  # Allow Owners to Edit Rejected Agreements

  1. Changes
    - Add policy to allow owners to update their own rejected agreements
    - This enables owners to make changes and resubmit after rejection
    - When editing a rejected agreement, they can change status back to draft or pending_approval

  2. Security
    - Only the original submitter (owner) can edit their rejected agreement
    - Must be authenticated and have owner role
    - Can only edit agreements for their yacht
*/

-- Policy: Owners can update their own rejected agreements
CREATE POLICY "Owners can update their own rejected vessel agreements"
  ON vessel_management_agreements
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status = 'rejected'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = vessel_management_agreements.yacht_id
      AND user_profiles.role = 'owner'
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = vessel_management_agreements.yacht_id
      AND user_profiles.role = 'owner'
    )
  );
