-- Update write policies (INSERT/UPDATE/DELETE) to remove is_master_user() bypass
-- Masters are now filtered by company_id = get_user_company_id() like everyone else

-- === yachts ===
DROP POLICY IF EXISTS "Staff can delete company yachts" ON yachts;
CREATE POLICY "Staff can delete company yachts"
  ON yachts FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company yachts" ON yachts;
CREATE POLICY "Staff can insert company yachts"
  ON yachts FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company yachts" ON yachts;
CREATE POLICY "Staff can update company yachts"
  ON yachts FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === yacht_bookings ===
DROP POLICY IF EXISTS "Users can delete company bookings" ON yacht_bookings;
CREATE POLICY "Users can delete company bookings"
  ON yacht_bookings FOR DELETE TO authenticated
  USING ((company_id = get_user_company_id() AND is_staff()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert company bookings" ON yacht_bookings;
CREATE POLICY "Users can insert company bookings"
  ON yacht_bookings FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update company bookings" ON yacht_bookings;
CREATE POLICY "Users can update company bookings"
  ON yacht_bookings FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid())
  WITH CHECK (company_id = get_user_company_id() OR user_id = auth.uid());

-- === customers ===
DROP POLICY IF EXISTS "Staff can delete company customers" ON customers;
CREATE POLICY "Staff can delete company customers"
  ON customers FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company customers" ON customers;
CREATE POLICY "Staff can insert company customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company customers" ON customers;
CREATE POLICY "Staff can update company customers"
  ON customers FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === estimates ===
DROP POLICY IF EXISTS "Staff can delete company estimates" ON estimates;
CREATE POLICY "Staff can delete company estimates"
  ON estimates FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company estimates" ON estimates;
CREATE POLICY "Staff can insert company estimates"
  ON estimates FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company estimates" ON estimates;
CREATE POLICY "Staff can update company estimates"
  ON estimates FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === work_orders ===
DROP POLICY IF EXISTS "Staff can delete company work orders" ON work_orders;
CREATE POLICY "Staff can delete company work orders"
  ON work_orders FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company work orders" ON work_orders;
CREATE POLICY "Staff can insert company work orders"
  ON work_orders FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company work orders" ON work_orders;
CREATE POLICY "Staff can update company work orders"
  ON work_orders FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === work_order_tasks ===
DROP POLICY IF EXISTS "Staff can delete company work order tasks" ON work_order_tasks;
CREATE POLICY "Staff can delete company work order tasks"
  ON work_order_tasks FOR DELETE TO authenticated
  USING (COALESCE(company_id, (SELECT wo.company_id FROM work_orders wo WHERE wo.id = work_order_tasks.work_order_id)) = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company work order tasks" ON work_order_tasks;
CREATE POLICY "Staff can insert company work order tasks"
  ON work_order_tasks FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company work order tasks" ON work_order_tasks;
CREATE POLICY "Staff can update company work order tasks"
  ON work_order_tasks FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === work_order_line_items ===
DROP POLICY IF EXISTS "Staff can delete company work order line items" ON work_order_line_items;
CREATE POLICY "Staff can delete company work order line items"
  ON work_order_line_items FOR DELETE TO authenticated
  USING (COALESCE(company_id, (SELECT wo.company_id FROM work_orders wo WHERE wo.id = work_order_line_items.work_order_id)) = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company work order line items" ON work_order_line_items;
CREATE POLICY "Staff can insert company work order line items"
  ON work_order_line_items FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company work order line items" ON work_order_line_items;
CREATE POLICY "Staff can update company work order line items"
  ON work_order_line_items FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === repair_requests ===
DROP POLICY IF EXISTS "Staff can delete company repair requests" ON repair_requests;
CREATE POLICY "Staff can delete company repair requests"
  ON repair_requests FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Users can insert company repair requests" ON repair_requests;
CREATE POLICY "Users can insert company repair requests"
  ON repair_requests FOR INSERT TO authenticated
  WITH CHECK (
    (company_id IS NOT NULL AND company_id = get_user_company_id())
    OR (company_id IS NULL AND submitted_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update company repair requests" ON repair_requests;
CREATE POLICY "Users can update company repair requests"
  ON repair_requests FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() OR submitted_by = auth.uid())
  WITH CHECK (company_id = get_user_company_id() OR submitted_by = auth.uid());

-- === maintenance_requests ===
DROP POLICY IF EXISTS "Staff can delete company maintenance requests" ON maintenance_requests;
CREATE POLICY "Staff can delete company maintenance requests"
  ON maintenance_requests FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Users can insert company maintenance requests" ON maintenance_requests;
CREATE POLICY "Users can insert company maintenance requests"
  ON maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update company maintenance requests" ON maintenance_requests;
CREATE POLICY "Users can update company maintenance requests"
  ON maintenance_requests FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid())
  WITH CHECK (company_id = get_user_company_id() OR user_id = auth.uid());
