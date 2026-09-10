-- Update RLS policies so masters are filtered by the selected company
-- Masters can still see all companies in the companies table, but all other
-- company-scoped tables filter by get_user_company_id() which now returns
-- the master's selected_company_id when set.

-- === yachts ===
DROP POLICY IF EXISTS "Users can view company yachts" ON yachts;
CREATE POLICY "Users can view company yachts"
  ON yachts FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === yacht_bookings ===
DROP POLICY IF EXISTS "Users can view company bookings" ON yacht_bookings;
CREATE POLICY "Users can view company bookings"
  ON yacht_bookings FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid());

-- === yacht_booking_owners ===
DROP POLICY IF EXISTS "Users can view company booking owners" ON yacht_booking_owners;
CREATE POLICY "Users can view company booking owners"
  ON yacht_booking_owners FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === customers ===
DROP POLICY IF EXISTS "Users can view company customers" ON customers;
CREATE POLICY "Users can view company customers"
  ON customers FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === customer_vessels ===
DROP POLICY IF EXISTS "Users can view company customer vessels" ON customer_vessels;
CREATE POLICY "Users can view company customer vessels"
  ON customer_vessels FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === estimates ===
DROP POLICY IF EXISTS "Users can view company estimates" ON estimates;
CREATE POLICY "Users can view company estimates"
  ON estimates FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === work_orders ===
DROP POLICY IF EXISTS "Users can view company work orders" ON work_orders;
CREATE POLICY "Users can view company work orders"
  ON work_orders FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === work_order_tasks ===
DROP POLICY IF EXISTS "Users can view company work order tasks" ON work_order_tasks;
CREATE POLICY "Users can view company work order tasks"
  ON work_order_tasks FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === work_order_line_items ===
DROP POLICY IF EXISTS "Users can view company work order line items" ON work_order_line_items;
CREATE POLICY "Users can view company work order line items"
  ON work_order_line_items FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === work_order_task_assignments ===
DROP POLICY IF EXISTS "Users can view company task assignments" ON work_order_task_assignments;
CREATE POLICY "Users can view company task assignments"
  ON work_order_task_assignments FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === work_order_time_entries ===
DROP POLICY IF EXISTS "Users can view company work order time entries" ON work_order_time_entries;
CREATE POLICY "Users can view company work order time entries"
  ON work_order_time_entries FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === repair_requests ===
DROP POLICY IF EXISTS "Users can view company repair requests" ON repair_requests;
CREATE POLICY "Users can view company repair requests"
  ON repair_requests FOR SELECT TO authenticated
  USING (
    (company_id IS NOT NULL AND company_id = get_user_company_id())
    OR (company_id IS NULL AND submitted_by = auth.uid())
  );

-- === maintenance_requests ===
DROP POLICY IF EXISTS "Users can view company maintenance requests" ON maintenance_requests;
CREATE POLICY "Users can view company maintenance requests"
  ON maintenance_requests FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid());

-- === user_profiles ===
-- Masters should only see users from the selected company
-- Non-master staff can see all users (they are scoped to their own company already)
DROP POLICY IF EXISTS "User profiles select policy" ON user_profiles;
CREATE POLICY "User profiles select policy"
  ON user_profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      is_staff()
      AND (
        NOT is_master_user()
        OR company_id = get_user_company_id()
      )
    )
  );
