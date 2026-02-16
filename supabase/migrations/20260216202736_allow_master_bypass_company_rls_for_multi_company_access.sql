/*
  # Allow Masters to Bypass Company RLS for Multi-Company Management

  1. Problem
    - RLS uses get_user_company_id() which returns master's own company
    - Even with selectedCompany in frontend, database blocks cross-company queries
    - Masters need to access data from ANY company they select
    
  2. Solution
    - Update all RLS policies to allow masters to bypass company_id check
    - Frontend will explicitly filter by selectedCompany.id
    - This provides flexibility for multi-company management
    
  3. Security
    - Masters are trusted administrators who need cross-company access
    - Frontend enforces which company data is displayed via explicit filters
    - Regular users still have strict company isolation via RLS
*/

-- Fix yachts policies to allow master bypass
DROP POLICY IF EXISTS "Users can view their company yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can update their company yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can delete their company yachts" ON yachts;

CREATE POLICY "Users can view company yachts"
  ON yachts FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company yachts"
  ON yachts FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company yachts"
  ON yachts FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix yacht_bookings policies
DROP POLICY IF EXISTS "Users can view their company bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Users can update their company bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Users can delete their company bookings" ON yacht_bookings;

CREATE POLICY "Users can view company bookings"
  ON yacht_bookings FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id() OR user_id = auth.uid());

CREATE POLICY "Users can update company bookings"
  ON yacht_bookings FOR UPDATE
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id() OR user_id = auth.uid())
  WITH CHECK (is_master_user() OR company_id = get_user_company_id() OR user_id = auth.uid());

CREATE POLICY "Users can delete company bookings"
  ON yacht_bookings FOR DELETE
  TO authenticated
  USING (is_master_user() OR (company_id = get_user_company_id() AND is_staff()) OR user_id = auth.uid());

-- Fix yacht_booking_owners policies
DROP POLICY IF EXISTS "Users can view their company booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Staff can update their company booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Staff can delete their company booking owners" ON yacht_booking_owners;

CREATE POLICY "Users can view company booking owners"
  ON yacht_booking_owners FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company booking owners"
  ON yacht_booking_owners FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company booking owners"
  ON yacht_booking_owners FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix work_orders policies
DROP POLICY IF EXISTS "Users can view their company work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff can update their company work orders" ON work_orders;
DROP POLICY IF EXISTS "Staff can delete their company work orders" ON work_orders;

CREATE POLICY "Users can view company work orders"
  ON work_orders FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company work orders"
  ON work_orders FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company work orders"
  ON work_orders FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix work_order_tasks policies
DROP POLICY IF EXISTS "Users can view their company work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Staff can update their company work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Staff can delete their company work order tasks" ON work_order_tasks;

CREATE POLICY "Users can view company work order tasks"
  ON work_order_tasks FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company work order tasks"
  ON work_order_tasks FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company work order tasks"
  ON work_order_tasks FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix work_order_line_items policies
DROP POLICY IF EXISTS "Users can view their company work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Staff can update their company work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Staff can delete their company work order line items" ON work_order_line_items;

CREATE POLICY "Users can view company work order line items"
  ON work_order_line_items FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company work order line items"
  ON work_order_line_items FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company work order line items"
  ON work_order_line_items FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix work_order_task_assignments policies
DROP POLICY IF EXISTS "Users can view their company task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Staff can update their company task assignments" ON work_order_task_assignments;
DROP POLICY IF EXISTS "Staff can delete their company task assignments" ON work_order_task_assignments;

CREATE POLICY "Users can view company task assignments"
  ON work_order_task_assignments FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company task assignments"
  ON work_order_task_assignments FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company task assignments"
  ON work_order_task_assignments FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix work_order_time_entries policies
DROP POLICY IF EXISTS "Users can view their company work order time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Staff can update their company work order time entries" ON work_order_time_entries;
DROP POLICY IF EXISTS "Staff can delete their company work order time entries" ON work_order_time_entries;

CREATE POLICY "Users can view company work order time entries"
  ON work_order_time_entries FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company work order time entries"
  ON work_order_time_entries FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company work order time entries"
  ON work_order_time_entries FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix estimates policies
DROP POLICY IF EXISTS "Users can view their company estimates" ON estimates;
DROP POLICY IF EXISTS "Staff can update their company estimates" ON estimates;
DROP POLICY IF EXISTS "Staff can delete their company estimates" ON estimates;

CREATE POLICY "Users can view company estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix customers policies
DROP POLICY IF EXISTS "Users can view their company customers" ON customers;
DROP POLICY IF EXISTS "Staff can update their company customers" ON customers;
DROP POLICY IF EXISTS "Staff can delete their company customers" ON customers;

CREATE POLICY "Users can view company customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company customers"
  ON customers FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company customers"
  ON customers FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix customer_vessels policies
DROP POLICY IF EXISTS "Users can view their company customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can update their company customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can delete their company customer vessels" ON customer_vessels;

CREATE POLICY "Users can view company customer vessels"
  ON customer_vessels FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id());

CREATE POLICY "Staff can update company customer vessels"
  ON customer_vessels FOR UPDATE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff())
  WITH CHECK ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company customer vessels"
  ON customer_vessels FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix maintenance_requests policies
DROP POLICY IF EXISTS "Users can view their company maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can update their company maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Staff can delete their company maintenance requests" ON maintenance_requests;

CREATE POLICY "Users can view company maintenance requests"
  ON maintenance_requests FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id() OR user_id = auth.uid());

CREATE POLICY "Users can update company maintenance requests"
  ON maintenance_requests FOR UPDATE
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id() OR user_id = auth.uid())
  WITH CHECK (is_master_user() OR company_id = get_user_company_id() OR user_id = auth.uid());

CREATE POLICY "Staff can delete company maintenance requests"
  ON maintenance_requests FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());

-- Fix repair_requests policies
DROP POLICY IF EXISTS "Users can view their company repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Users can update their company repair requests" ON repair_requests;
DROP POLICY IF EXISTS "Staff can delete their company repair requests" ON repair_requests;

CREATE POLICY "Users can view company repair requests"
  ON repair_requests FOR SELECT
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id() OR submitted_by = auth.uid());

CREATE POLICY "Users can update company repair requests"
  ON repair_requests FOR UPDATE
  TO authenticated
  USING (is_master_user() OR company_id = get_user_company_id() OR submitted_by = auth.uid())
  WITH CHECK (is_master_user() OR company_id = get_user_company_id() OR submitted_by = auth.uid());

CREATE POLICY "Staff can delete company repair requests"
  ON repair_requests FOR DELETE
  TO authenticated
  USING ((is_master_user() OR company_id = get_user_company_id()) AND is_staff());
