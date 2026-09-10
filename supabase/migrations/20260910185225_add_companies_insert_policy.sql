-- Add missing INSERT policy for companies table
-- Master users need to be able to create new companies
CREATE POLICY "Master users can insert new companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (is_master_user());
