-- Update remaining SELECT policies for work_order_task_assignments and work_order_time_entries
DROP POLICY IF EXISTS "Users can view company task assignments" ON work_order_task_assignments;
CREATE POLICY "Users can view company task assignments"
  ON work_order_task_assignments FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view company work order time entries" ON work_order_time_entries;
CREATE POLICY "Users can view company work order time entries"
  ON work_order_time_entries FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- Also update yacht_booking_owners SELECT (already done above but verify)
-- And customer_vessels SELECT (already done above)
