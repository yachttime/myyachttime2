/*
  # Allow staff to insert repair requests for any yacht

  ## Change
  - Drops the existing staff insert policy on repair_requests that restricts
    staff to only their assigned yacht_id
  - Creates a new insert policy that allows any active staff/mechanic to
    submit a repair request for any yacht in their company

  ## Reason
  Staff members take calls from owners and need to be able to log repair
  requests on behalf of any yacht, not just the one stored in their profile.
*/

DROP POLICY IF EXISTS "Staff can insert repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Authenticated users can insert repair requests" ON repair_requests;

CREATE POLICY "Staff can insert repair requests for any yacht"
  ON repair_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('staff', 'mechanic', 'master')
        AND is_active = true
    )
  );
