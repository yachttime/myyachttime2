-- Fix INSERT policy to enforce company_id matches the inserting user's company
DROP POLICY IF EXISTS "staff_insert_repair_request_notes" ON repair_request_notes;

CREATE POLICY "staff_insert_repair_request_notes" ON repair_request_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('staff', 'mechanic', 'master', 'manager')
    AND company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Fix SELECT policy for staff/master/manager to also handle null company_id gracefully
DROP POLICY IF EXISTS "staff_master_select_repair_request_notes" ON repair_request_notes;

CREATE POLICY "staff_master_select_repair_request_notes" ON repair_request_notes FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('staff', 'mechanic', 'master', 'manager')
    AND (
      company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid())
      OR company_id IS NULL
    )
  );
