/*
  # Create Helper Functions and Companies RLS

  1. Helper Functions
    - `get_user_company_id()` - Returns company_id for current user (NULL for masters)
    - `is_master_user()` - Returns true if current user has master role
    - `user_has_company_access(company_uuid)` - Checks if user can access a company

  2. RLS Policies for Companies Table
    - Master users can do everything (SELECT, INSERT, UPDATE, DELETE)
    - Regular users can only SELECT their own company
    - Company data is completely isolated between companies
*/

-- Helper function: Get current user's company_id from user_profiles
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE user_id = auth.uid();
$$;

-- Helper function: Check if current user is a master user
CREATE OR REPLACE FUNCTION is_master_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'master'
  );
$$;

-- Helper function: Check if user has access to a specific company
CREATE OR REPLACE FUNCTION user_has_company_access(company_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      WHEN is_master_user() THEN true
      WHEN get_user_company_id() = company_uuid THEN true
      ELSE false
    END;
$$;

-- RLS Policies for companies table

-- Master users can view all companies
CREATE POLICY "Master users can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (is_master_user());

-- Regular users can view their own company
CREATE POLICY "Users can view their own company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

-- Master users can insert companies
CREATE POLICY "Master users can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (is_master_user());

-- Master users can update companies
CREATE POLICY "Master users can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (is_master_user())
  WITH CHECK (is_master_user());

-- Master users can delete companies (soft delete via is_active preferred)
CREATE POLICY "Master users can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (is_master_user());
