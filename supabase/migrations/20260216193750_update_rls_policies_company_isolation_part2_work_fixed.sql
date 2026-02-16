/*
  # Update RLS Policies for Company Isolation - Part 2: Work Management Tables (Fixed)

  1. Tables Updated
    - repair_requests (uses submitted_by column)
    - work_orders
    - work_order_tasks
    - work_order_task_assignments
    - work_order_line_items
    - work_order_time_entries
    - estimates
    - maintenance_requests (uses user_id column)

  2. Policy Pattern
    - Master users: can access all companies
    - Regular users: can only access their company's data
    - Owners: can view their own requests

  3. Notes
    - Preserves owner access to their own data
    - Complete company isolation for all work-related data
*/

-- REPAIR_REQUESTS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view all repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Users can view their own repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Anyone can create repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Users can update their own repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Staff can update repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Staff can delete repair requests" ON repair_requests;

-- Create new company-isolated policies
CREATE POLICY "Users can view company repair requests"
  ON repair_requests
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    submitted_by = auth.uid()
  );

CREATE POLICY "Users can insert company repair requests"
  ON repair_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Users can update company repair requests"
  ON repair_requests
  FOR UPDATE
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    submitted_by = auth.uid()
  )
  WITH CHECK (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can delete company repair requests"
  ON repair_requests
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- WORK_ORDERS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff and mechanics can view company work orders" ON work_orders;
DROP POLICY IF EXISTS "Master users can insert work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff and mechanics can insert work orders" ON work_orders;
DROP POLICY IF EXISTS "Master users can update work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff and mechanics can update work orders" ON work_orders;
DROP POLICY IF EXISTS "Master users can delete work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff and mechanics can delete work orders" ON work_orders;

-- Create new company-isolated policies
CREATE POLICY "Users can view company work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company work orders"
  ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company work orders"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company work orders"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- WORK_ORDER_TASKS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Staff and mechanics can view company work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Master users can insert work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Staff and mechanics can insert work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Master users can update work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Staff and mechanics can update work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Master users can delete work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Staff and mechanics can delete work order tasks" ON work_order_tasks;

-- Create new company-isolated policies
CREATE POLICY "Users can view company work order tasks"
  ON work_order_tasks
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company work order tasks"
  ON work_order_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company work order tasks"
  ON work_order_tasks
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company work order tasks"
  ON work_order_tasks
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- WORK_ORDER_TASK_ASSIGNMENTS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Staff and mechanics can view company task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Master users can insert task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Staff and mechanics can insert task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Master users can update task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Staff and mechanics can update task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Master users can delete task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Staff and mechanics can delete task assignments" ON work_order_task_assignments;

-- Create new company-isolated policies
CREATE POLICY "Users can view company task assignments"
  ON work_order_task_assignments
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company task assignments"
  ON work_order_task_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company task assignments"
  ON work_order_task_assignments
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company task assignments"
  ON work_order_task_assignments
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- WORK_ORDER_LINE_ITEMS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Staff and mechanics can view company work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Master users can insert work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Staff and mechanics can insert work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Master users can update work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Staff and mechanics can update work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Master users can delete work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Staff and mechanics can delete work order line items" ON work_order_line_items;

-- Create new company-isolated policies
CREATE POLICY "Users can view company work order line items"
  ON work_order_line_items
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company work order line items"
  ON work_order_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company work order line items"
  ON work_order_line_items
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company work order line items"
  ON work_order_line_items
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- WORK_ORDER_TIME_ENTRIES TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Staff and mechanics can view company time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Master users can insert time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Staff and mechanics can insert time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Master users can update time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Staff and mechanics can update time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Master users can delete time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Staff and mechanics can delete time entries" ON work_order_time_entries;

-- Create new company-isolated policies
CREATE POLICY "Users can view company work order time entries"
  ON work_order_time_entries
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company work order time entries"
  ON work_order_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company work order time entries"
  ON work_order_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company work order time entries"
  ON work_order_time_entries
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- ESTIMATES TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all estimates" ON estimates;
DROP POLICY IF EXISTS "Staff and mechanics can view company estimates" ON estimates;
DROP POLICY IF EXISTS "Master users can insert estimates" ON estimates;
DROP POLICY IF EXISTS "Staff and mechanics can insert estimates" ON estimates;
DROP POLICY IF EXISTS "Master users can update estimates" ON estimates;
DROP POLICY IF EXISTS "Staff and mechanics can update estimates" ON estimates;
DROP POLICY IF EXISTS "Master users can delete estimates" ON estimates;
DROP POLICY IF EXISTS "Staff and mechanics can delete estimates" ON estimates;

-- Create new company-isolated policies
CREATE POLICY "Users can view company estimates"
  ON estimates
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company estimates"
  ON estimates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company estimates"
  ON estimates
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company estimates"
  ON estimates
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- MAINTENANCE_REQUESTS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their yacht maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Staff can view all maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can create maintenance requests for their yachts" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can update their maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Staff can update maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Staff can delete maintenance requests" ON maintenance_requests;

-- Create new company-isolated policies
CREATE POLICY "Users can view company maintenance requests"
  ON maintenance_requests
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert company maintenance requests"
  ON maintenance_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Users can update company maintenance requests"
  ON maintenance_requests
  FOR UPDATE
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    user_id = auth.uid()
  )
  WITH CHECK (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can delete company maintenance requests"
  ON maintenance_requests
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );
