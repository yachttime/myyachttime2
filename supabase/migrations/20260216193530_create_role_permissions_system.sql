/*
  # Create Role Permissions System

  1. New Tables
    - `role_permissions` - Stores permission settings for each role per company
      - `id` (uuid, primary key)
      - `company_id` (uuid, nullable) - NULL for global defaults, specific for company overrides
      - `role` (text) - staff, admin, captain, mechanic, manager
      - `permission_key` (text) - Permission identifier
      - `is_enabled` (boolean) - Whether permission is enabled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Permission Keys Defined
    - User Management: manage_users, view_all_users
    - Yacht Management: manage_yachts, view_all_yachts, view_assigned_yachts_only
    - Work Management: create_work_orders, edit_work_orders, delete_work_orders, approve_repairs
    - Financial: view_financials, manage_invoices, manage_estimates, approve_billing
    - Inventory: manage_parts_inventory, order_parts
    - Payroll: access_payroll, manage_payroll, view_own_payroll_only
    - Settings: manage_labor_codes, manage_accounting_codes, manage_company_settings
    - Smart Devices: manage_smart_devices
    - Customer Management: manage_customers
    - Analytics: view_analytics, view_reports

  3. Helper Functions
    - `user_has_permission(permission_key, user_id)` - Check if user has a specific permission
    - `get_user_permissions(user_id)` - Get all permissions for a user

  4. Default Permissions
    - Seed default permissions for each role
    - Master role always has all permissions (checked separately)

  5. Security
    - Enable RLS
    - Master users can manage all permissions
    - Regular users can only view permissions (read-only)
*/

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id), -- NULL for global defaults
  role text NOT NULL CHECK (role IN ('staff', 'admin', 'captain', 'mechanic', 'manager')),
  permission_key text NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, role, permission_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_company_id ON role_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON role_permissions(permission_key);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(perm_key text, check_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
  user_company_id uuid;
  has_perm boolean;
BEGIN
  -- Use provided user_id or current user
  IF check_user_id IS NULL THEN
    check_user_id := auth.uid();
  END IF;
  
  -- Get user role and company
  SELECT role, company_id INTO user_role, user_company_id
  FROM user_profiles
  WHERE user_id = check_user_id;
  
  -- Master users always have all permissions
  IF user_role = 'master' THEN
    RETURN true;
  END IF;
  
  -- Check company-specific permission first, fall back to global default
  SELECT COALESCE(
    (SELECT is_enabled FROM role_permissions 
     WHERE company_id = user_company_id 
       AND role = user_role 
       AND permission_key = perm_key
     LIMIT 1),
    (SELECT is_enabled FROM role_permissions 
     WHERE company_id IS NULL 
       AND role = user_role 
       AND permission_key = perm_key
     LIMIT 1),
    false
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$;

-- Helper function: Get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(check_user_id uuid DEFAULT NULL)
RETURNS TABLE(permission_key text, is_enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
  user_company_id uuid;
BEGIN
  -- Use provided user_id or current user
  IF check_user_id IS NULL THEN
    check_user_id := auth.uid();
  END IF;
  
  -- Get user role and company
  SELECT up.role, up.company_id INTO user_role, user_company_id
  FROM user_profiles up
  WHERE up.user_id = check_user_id;
  
  -- Master users have all permissions
  IF user_role = 'master' THEN
    RETURN QUERY
    SELECT DISTINCT rp.permission_key, true AS is_enabled
    FROM role_permissions rp;
    RETURN;
  END IF;
  
  -- Return company-specific permissions, falling back to global defaults
  RETURN QUERY
  SELECT DISTINCT
    rp.permission_key,
    COALESCE(
      (SELECT is_enabled FROM role_permissions 
       WHERE company_id = user_company_id 
         AND role = user_role 
         AND permission_key = rp.permission_key
       LIMIT 1),
      rp.is_enabled
    ) AS is_enabled
  FROM role_permissions rp
  WHERE rp.company_id IS NULL AND rp.role = user_role;
END;
$$;

-- RLS Policies

-- Master users can view all permissions
CREATE POLICY "Master users can view all permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (is_master_user());

-- Users can view their company's permissions and global defaults
CREATE POLICY "Users can view their company permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR 
    company_id = get_user_company_id()
  );

-- Master users can insert permissions
CREATE POLICY "Master users can insert permissions"
  ON role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_master_user());

-- Master users can update permissions
CREATE POLICY "Master users can update permissions"
  ON role_permissions
  FOR UPDATE
  TO authenticated
  USING (is_master_user())
  WITH CHECK (is_master_user());

-- Master users can delete permissions
CREATE POLICY "Master users can delete permissions"
  ON role_permissions
  FOR DELETE
  TO authenticated
  USING (is_master_user());

-- Seed default permissions for all roles (global defaults, company_id = NULL)
INSERT INTO role_permissions (company_id, role, permission_key, is_enabled) VALUES
  -- Staff permissions (limited)
  (NULL, 'staff', 'view_assigned_yachts_only', true),
  (NULL, 'staff', 'create_work_orders', true),
  (NULL, 'staff', 'edit_work_orders', true),
  (NULL, 'staff', 'view_own_payroll_only', true),
  (NULL, 'staff', 'manage_parts_inventory', false),
  (NULL, 'staff', 'view_financials', false),
  (NULL, 'staff', 'manage_customers', false),
  
  -- Mechanic permissions (similar to staff but with inventory access)
  (NULL, 'mechanic', 'view_assigned_yachts_only', true),
  (NULL, 'mechanic', 'create_work_orders', true),
  (NULL, 'mechanic', 'edit_work_orders', true),
  (NULL, 'mechanic', 'view_own_payroll_only', true),
  (NULL, 'mechanic', 'manage_parts_inventory', true),
  (NULL, 'mechanic', 'order_parts', true),
  (NULL, 'mechanic', 'view_financials', false),
  
  -- Captain permissions (yacht-focused)
  (NULL, 'captain', 'view_assigned_yachts_only', true),
  (NULL, 'captain', 'create_work_orders', true),
  (NULL, 'captain', 'manage_smart_devices', true),
  (NULL, 'captain', 'view_own_payroll_only', true),
  (NULL, 'captain', 'view_financials', false),
  
  -- Manager permissions (broader access, but not all settings)
  (NULL, 'manager', 'view_all_yachts', true),
  (NULL, 'manager', 'manage_yachts', true),
  (NULL, 'manager', 'create_work_orders', true),
  (NULL, 'manager', 'edit_work_orders', true),
  (NULL, 'manager', 'delete_work_orders', true),
  (NULL, 'manager', 'approve_repairs', true),
  (NULL, 'manager', 'approve_billing', true),
  (NULL, 'manager', 'view_financials', true),
  (NULL, 'manager', 'manage_invoices', true),
  (NULL, 'manager', 'manage_estimates', true),
  (NULL, 'manager', 'manage_customers', true),
  (NULL, 'manager', 'manage_parts_inventory', true),
  (NULL, 'manager', 'order_parts', true),
  (NULL, 'manager', 'access_payroll', true),
  (NULL, 'manager', 'view_analytics', true),
  (NULL, 'manager', 'view_reports', true),
  (NULL, 'manager', 'manage_smart_devices', true),
  (NULL, 'manager', 'manage_users', false),
  (NULL, 'manager', 'manage_company_settings', false),
  
  -- Admin permissions (full access except master-only features)
  (NULL, 'admin', 'manage_users', true),
  (NULL, 'admin', 'view_all_users', true),
  (NULL, 'admin', 'manage_yachts', true),
  (NULL, 'admin', 'view_all_yachts', true),
  (NULL, 'admin', 'create_work_orders', true),
  (NULL, 'admin', 'edit_work_orders', true),
  (NULL, 'admin', 'delete_work_orders', true),
  (NULL, 'admin', 'approve_repairs', true),
  (NULL, 'admin', 'approve_billing', true),
  (NULL, 'admin', 'view_financials', true),
  (NULL, 'admin', 'manage_invoices', true),
  (NULL, 'admin', 'manage_estimates', true),
  (NULL, 'admin', 'manage_customers', true),
  (NULL, 'admin', 'manage_parts_inventory', true),
  (NULL, 'admin', 'order_parts', true),
  (NULL, 'admin', 'access_payroll', true),
  (NULL, 'admin', 'manage_payroll', true),
  (NULL, 'admin', 'manage_labor_codes', true),
  (NULL, 'admin', 'manage_accounting_codes', true),
  (NULL, 'admin', 'manage_company_settings', true),
  (NULL, 'admin', 'manage_smart_devices', true),
  (NULL, 'admin', 'view_analytics', true),
  (NULL, 'admin', 'view_reports', true)
ON CONFLICT (company_id, role, permission_key) DO NOTHING;

-- Create updated_at trigger
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();
