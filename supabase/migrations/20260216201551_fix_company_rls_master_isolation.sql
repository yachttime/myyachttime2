/*
  # Fix Company RLS - Restrict Master Users to Their Own Company

  1. Changes
    - Remove cross-company access for master users
    - Master users can only view/manage their own company
    - Ensures proper company data isolation
    
  2. Security
    - Master users are scoped to their assigned company_id only
    - No cross-company data access
    - Maintains company isolation boundary
*/

-- Drop existing master policies that allow cross-company access
DROP POLICY IF EXISTS "Master users can view all companies" ON companies;
DROP POLICY IF EXISTS "Master users can update companies" ON companies;
DROP POLICY IF EXISTS "Master users can insert companies" ON companies;
DROP POLICY IF EXISTS "Master users can delete companies" ON companies;

-- Recreate policies with company_id restriction
CREATE POLICY "Master users can view their own company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() AND id = get_user_company_id()
  );

CREATE POLICY "Master users can update their own company"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    is_master_user() AND id = get_user_company_id()
  )
  WITH CHECK (
    is_master_user() AND id = get_user_company_id()
  );

-- Note: Removed INSERT and DELETE policies for master users
-- Companies should only be created by system admins, not through the app
