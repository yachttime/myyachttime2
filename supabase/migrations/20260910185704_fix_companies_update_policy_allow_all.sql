-- Allow master users to update any company, not just their own
-- The previous policy restricted updates to id = get_user_company_id() which blocked
-- editing other companies in the multi-company management screen
DROP POLICY IF EXISTS "Master users can update their own company" ON companies;
CREATE POLICY "Master users can update any company"
  ON companies FOR UPDATE
  TO authenticated
  USING (is_master_user())
  WITH CHECK (is_master_user());
