/*
  # Allow Master Users to View All Companies for Company Switching

  1. Changes
    - Allow master users to view all companies (needed for company switcher)
    - Masters can only update their own company
    - Data isolation is enforced at the table level (yachts, users, work orders, etc.)
    
  2. Security
    - Masters can see company list for switching context
    - But RLS on other tables enforces company_id filtering
    - This allows proper multi-company management
*/

-- Update the SELECT policy to allow masters to see all companies
DROP POLICY IF EXISTS "Master users can view their own company" ON companies;

CREATE POLICY "Master users can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    is_master_user()
  );

-- Keep the update policy restricted to own company
DROP POLICY IF EXISTS "Master users can update their own company" ON companies;

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
