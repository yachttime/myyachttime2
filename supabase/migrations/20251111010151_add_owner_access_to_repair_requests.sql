/*
  # Add Owner Access to Repair Requests

  1. Changes
    - Add policy to allow owners to view repair requests for their assigned yacht
    - Owners can see all repair requests related to their yacht, not just their own submissions
  
  2. Security
    - Owners can only view repair requests for yachts assigned to them via user_profiles.yacht_id
    - Existing policies for staff and managers remain unchanged
*/

CREATE POLICY "Owners can view repair requests for their yacht"
  ON repair_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = repair_requests.yacht_id
    )
  );
