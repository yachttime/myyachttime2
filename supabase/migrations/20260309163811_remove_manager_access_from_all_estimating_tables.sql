/*
  # Remove manager role access from all estimating system tables

  ## Reason
  The "manager" role represents yacht owners, not internal staff. They should
  not have access to the estimating system (estimates, work orders, line items,
  tasks, invoices, parts, labor codes, accounting codes, etc.).

  ## Changes
  Drops all RLS policies on estimating-related tables that grant access based
  on the manager role (identified by "Managers with repair approval" naming).
*/

-- estimates
DROP POLICY IF EXISTS "Managers with repair approval can view estimates" ON estimates;
DROP POLICY IF EXISTS "Managers with repair approval can insert estimates" ON estimates;
DROP POLICY IF EXISTS "Managers with repair approval can update estimates" ON estimates;
DROP POLICY IF EXISTS "Managers with repair approval can delete estimates" ON estimates;

-- estimate_tasks
DROP POLICY IF EXISTS "Managers with repair approval can view estimate tasks" ON estimate_tasks;
DROP POLICY IF EXISTS "Managers with repair approval can insert estimate tasks" ON estimate_tasks;
DROP POLICY IF EXISTS "Managers with repair approval can update estimate tasks" ON estimate_tasks;
DROP POLICY IF EXISTS "Managers with repair approval can delete estimate tasks" ON estimate_tasks;

-- estimate_line_items
DROP POLICY IF EXISTS "Managers with repair approval can view estimate line items" ON estimate_line_items;
DROP POLICY IF EXISTS "Managers with repair approval can insert estimate line items" ON estimate_line_items;
DROP POLICY IF EXISTS "Managers with repair approval can update estimate line items" ON estimate_line_items;
DROP POLICY IF EXISTS "Managers with repair approval can delete estimate line items" ON estimate_line_items;

-- work_orders
DROP POLICY IF EXISTS "Managers with repair approval can view work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers with repair approval can insert work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers with repair approval can update work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers with repair approval can delete work orders" ON work_orders;

-- work_order_tasks
DROP POLICY IF EXISTS "Managers with repair approval can view work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Managers with repair approval can insert work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Managers with repair approval can update work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Managers with repair approval can delete work order tasks" ON work_order_tasks;

-- work_order_line_items
DROP POLICY IF EXISTS "Managers with repair approval can view work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Managers with repair approval can insert work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Managers with repair approval can update work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Managers with repair approval can delete work order line items" ON work_order_line_items;

-- estimate_settings
DROP POLICY IF EXISTS "Managers with repair approval can view estimate settings" ON estimate_settings;
DROP POLICY IF EXISTS "Managers with repair approval can update estimate settings" ON estimate_settings;

-- accounting_codes
DROP POLICY IF EXISTS "Managers with repair approval can view accounting codes" ON accounting_codes;

-- labor_codes
DROP POLICY IF EXISTS "Managers with repair approval can view labor codes" ON labor_codes;

-- parts_inventory
DROP POLICY IF EXISTS "Managers with repair approval can view parts inventory" ON parts_inventory;
DROP POLICY IF EXISTS "Managers with repair approval can update parts inventory" ON parts_inventory;

-- vendors
DROP POLICY IF EXISTS "Managers with repair approval can view vendors" ON vendors;

-- company_info
DROP POLICY IF EXISTS "Managers with repair approval can view company info" ON company_info;
