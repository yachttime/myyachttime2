-- Fix remaining RLS policies to enforce company isolation for masters
-- These tables had SELECT policies that bypassed company filtering for masters/staff

-- === accounting_codes ===
DROP POLICY IF EXISTS "Master users can view accounting codes" ON accounting_codes;
CREATE POLICY "Users can view company accounting codes"
  ON accounting_codes FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === admin_notifications ===
DROP POLICY IF EXISTS "Authenticated users can view admin notifications" ON admin_notifications;
CREATE POLICY "Authenticated users can view admin notifications"
  ON admin_notifications FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR company_id IS NULL);

-- === appointments ===
DROP POLICY IF EXISTS "Staff, managers, and master can view all appointments" ON appointments;
CREATE POLICY "Staff and managers can view company appointments"
  ON appointments FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === customer_vessel_engines ===
DROP POLICY IF EXISTS "Authenticated users can view customer vessel engines" ON customer_vessel_engines;
CREATE POLICY "Users can view company customer vessel engines"
  ON customer_vessel_engines FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === customer_vessel_generators ===
DROP POLICY IF EXISTS "Authenticated users can view customer vessel generators" ON customer_vessel_generators;
CREATE POLICY "Users can view company customer vessel generators"
  ON customer_vessel_generators FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === education_videos ===
DROP POLICY IF EXISTS "Authenticated users can view education videos" ON education_videos;
CREATE POLICY "Authenticated users can view company education videos"
  ON education_videos FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR company_id IS NULL);

-- === estimate_line_items ===
DROP POLICY IF EXISTS "Master users can view estimate line items" ON estimate_line_items;
CREATE POLICY "Users can view company estimate line items"
  ON estimate_line_items FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === estimate_package_parts ===
DROP POLICY IF EXISTS "Staff and master can view package parts" ON estimate_package_parts;
CREATE POLICY "Users can view company estimate package parts"
  ON estimate_package_parts FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === estimate_packages ===
DROP POLICY IF EXISTS "Staff and master can view packages" ON estimate_packages;
CREATE POLICY "Users can view company estimate packages"
  ON estimate_packages FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === estimate_settings ===
DROP POLICY IF EXISTS "Master users can view estimate settings" ON estimate_settings;
CREATE POLICY "Users can view company estimate settings"
  ON estimate_settings FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === estimate_tasks ===
DROP POLICY IF EXISTS "Master users can view estimate tasks" ON estimate_tasks;
CREATE POLICY "Users can view company estimate tasks"
  ON estimate_tasks FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === estimating_invoices ===
DROP POLICY IF EXISTS "Manager can view estimating invoices for their yacht" ON estimating_invoices;
DROP POLICY IF EXISTS "Master users can view estimating invoices" ON estimating_invoices;
CREATE POLICY "Users can view company estimating invoices"
  ON estimating_invoices FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === inspection_time_entries ===
DROP POLICY IF EXISTS "Staff can view all inspection time entries" ON inspection_time_entries;
CREATE POLICY "Staff can view company inspection time entries"
  ON inspection_time_entries FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === labor_codes ===
DROP POLICY IF EXISTS "Master users can view labor codes" ON labor_codes;
CREATE POLICY "Users can view company labor codes"
  ON labor_codes FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === parts_inventory ===
DROP POLICY IF EXISTS "Master users can view parts inventory" ON parts_inventory;
CREATE POLICY "Users can view company parts inventory"
  ON parts_inventory FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === pay_periods ===
DROP POLICY IF EXISTS "Staff can view all pay periods" ON pay_periods;
CREATE POLICY "Users can view company pay periods"
  ON pay_periods FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === purchase_order_line_items ===
DROP POLICY IF EXISTS "Staff and above can view PO line items" ON purchase_order_line_items;
CREATE POLICY "Users can view company PO line items"
  ON purchase_order_line_items FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === purchase_orders ===
DROP POLICY IF EXISTS "Staff and above can view purchase orders" ON purchase_orders;
CREATE POLICY "Users can view company purchase orders"
  ON purchase_orders FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === receipts ===
DROP POLICY IF EXISTS "mechanic_select_own_receipts" ON receipts;
CREATE POLICY "Users can view company receipts"
  ON receipts FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === repair_request_notes ===
DROP POLICY IF EXISTS "owner_select_own_retail_repair_request_notes" ON repair_request_notes;
DROP POLICY IF EXISTS "owner_select_repair_request_notes" ON repair_request_notes;
CREATE POLICY "Users can view company repair request notes"
  ON repair_request_notes FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR company_id IS NULL);

-- === staff_messages ===
DROP POLICY IF EXISTS "Staff and managers can view all staff messages" ON staff_messages;
CREATE POLICY "Users can view company staff messages"
  ON staff_messages FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === staff_schedule_overrides ===
DROP POLICY IF EXISTS "Master and staff can view all schedule overrides" ON staff_schedule_overrides;
CREATE POLICY "Users can view company schedule overrides"
  ON staff_schedule_overrides FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === staff_schedules ===
DROP POLICY IF EXISTS "Staff can view all schedules" ON staff_schedules;
CREATE POLICY "Users can view company schedules"
  ON staff_schedules FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === staff_time_off_requests ===
DROP POLICY IF EXISTS "Staff can view all time off requests" ON staff_time_off_requests;
CREATE POLICY "Users can view company time off requests"
  ON staff_time_off_requests FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === trip_inspections ===
DROP POLICY IF EXISTS "Authenticated users can view trip inspections" ON trip_inspections;
CREATE POLICY "Users can view company trip inspections"
  ON trip_inspections FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === vendors ===
DROP POLICY IF EXISTS "Master users can view vendors" ON vendors;
CREATE POLICY "Users can view company vendors"
  ON vendors FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === vessel_management_agreements ===
DROP POLICY IF EXISTS "Users can view vessel agreements for their yacht" ON vessel_management_agreements;
CREATE POLICY "Users can view company vessel agreements"
  ON vessel_management_agreements FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === yacht_budgets ===
DROP POLICY IF EXISTS "Master can view all budgets" ON yacht_budgets;
CREATE POLICY "Users can view company yacht budgets"
  ON yacht_budgets FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === yacht_engines ===
DROP POLICY IF EXISTS "Authenticated users can view yacht engines" ON yacht_engines;
CREATE POLICY "Users can view company yacht engines"
  ON yacht_engines FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === yacht_generators ===
DROP POLICY IF EXISTS "Authenticated users can view yacht generators" ON yacht_generators;
CREATE POLICY "Users can view company yacht generators"
  ON yacht_generators FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === yacht_invoices ===
DROP POLICY IF EXISTS "yacht_invoices_select_policy" ON yacht_invoices;
CREATE POLICY "Users can view company yacht invoices"
  ON yacht_invoices FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === yacht_partners ===
DROP POLICY IF EXISTS "Staff and master can manage yacht partners" ON yacht_partners;
CREATE POLICY "Users can view company yacht partners"
  ON yacht_partners FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === Remaining write policies ===
-- customer_vessels
DROP POLICY IF EXISTS "Staff can delete company customer vessels" ON customer_vessels;
CREATE POLICY "Staff can delete company customer vessels"
  ON customer_vessels FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company customer vessels" ON customer_vessels;
CREATE POLICY "Staff can insert company customer vessels"
  ON customer_vessels FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company customer vessels" ON customer_vessels;
CREATE POLICY "Staff can update company customer vessels"
  ON customer_vessels FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- yacht_booking_owners
DROP POLICY IF EXISTS "Staff can delete company booking owners" ON yacht_booking_owners;
CREATE POLICY "Staff can delete company booking owners"
  ON yacht_booking_owners FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company booking owners" ON yacht_booking_owners;
CREATE POLICY "Staff can insert company booking owners"
  ON yacht_booking_owners FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company booking owners" ON yacht_booking_owners;
CREATE POLICY "Staff can update company booking owners"
  ON yacht_booking_owners FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- work_order_task_assignments
DROP POLICY IF EXISTS "Staff can delete company task assignments" ON work_order_task_assignments;
CREATE POLICY "Staff can delete company task assignments"
  ON work_order_task_assignments FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company task assignments" ON work_order_task_assignments;
CREATE POLICY "Staff can insert company task assignments"
  ON work_order_task_assignments FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company task assignments" ON work_order_task_assignments;
CREATE POLICY "Staff can update company task assignments"
  ON work_order_task_assignments FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- work_order_time_entries
DROP POLICY IF EXISTS "Staff can delete company work order time entries" ON work_order_time_entries;
CREATE POLICY "Staff can delete company work order time entries"
  ON work_order_time_entries FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can insert company work order time entries" ON work_order_time_entries;
CREATE POLICY "Staff can insert company work order time entries"
  ON work_order_time_entries FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

DROP POLICY IF EXISTS "Staff can update company work order time entries" ON work_order_time_entries;
CREATE POLICY "Staff can update company work order time entries"
  ON work_order_time_entries FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_staff())
  WITH CHECK (company_id = get_user_company_id() AND is_staff());

-- === estimating_invoice_line_items (no company_id column - filter via parent invoice) ===
DROP POLICY IF EXISTS "Staff can view estimating invoice line items" ON estimating_invoice_line_items;
CREATE POLICY "Users can view company estimating invoice line items"
  ON estimating_invoice_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      WHERE ei.id = estimating_invoice_line_items.invoice_id
      AND ei.company_id = get_user_company_id()
    )
  );
