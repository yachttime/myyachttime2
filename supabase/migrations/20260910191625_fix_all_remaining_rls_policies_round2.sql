-- Fix ALL remaining RLS policies for company isolation
-- These tables either bypass company filtering for masters or use
-- user_profiles.company_id directly instead of get_user_company_id()

-- === Tables with company_id column and unfiltered SELECT policies ===

-- engine_catalog
DROP POLICY IF EXISTS "select_engine_catalog" ON engine_catalog;
CREATE POLICY "Users can view company engine catalog"
  ON engine_catalog FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- estimate_fees_config
DROP POLICY IF EXISTS "Master users can view fee config" ON estimate_fees_config;
CREATE POLICY "Users can view company fee config"
  ON estimate_fees_config FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- estimate_package_labor
DROP POLICY IF EXISTS "Staff and master can view package labor" ON estimate_package_labor;
CREATE POLICY "Users can view company package labor"
  ON estimate_package_labor FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- mercury_marine_parts
DROP POLICY IF EXISTS "Staff can view active Mercury parts" ON mercury_marine_parts;
CREATE POLICY "Users can view company Mercury parts"
  ON mercury_marine_parts FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- mercury_price_list_imports
DROP POLICY IF EXISTS "Masters can view all import records" ON mercury_price_list_imports;
CREATE POLICY "Users can view company import records"
  ON mercury_price_list_imports FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- owner_chat_messages (has company_id)
DROP POLICY IF EXISTS "Owners can view chat for their yacht" ON owner_chat_messages;
DROP POLICY IF EXISTS "Staff can view all chat messages" ON owner_chat_messages;
CREATE POLICY "Users can view company chat messages"
  ON owner_chat_messages FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- part_transactions
DROP POLICY IF EXISTS "Master users can view part transactions" ON part_transactions;
CREATE POLICY "Users can view company part transactions"
  ON part_transactions FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- payroll_periods
DROP POLICY IF EXISTS "Staff can view payroll periods" ON payroll_periods;
CREATE POLICY "Users can view company payroll periods"
  ON payroll_periods FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- quickbooks_account_mappings
DROP POLICY IF EXISTS "Staff can view QuickBooks mappings" ON quickbooks_account_mappings;
CREATE POLICY "Users can view company QB mappings"
  ON quickbooks_account_mappings FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- quickbooks_accounts
DROP POLICY IF EXISTS "Staff can view QuickBooks accounts" ON quickbooks_accounts;
CREATE POLICY "Users can view company QB accounts"
  ON quickbooks_accounts FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- quickbooks_connection
DROP POLICY IF EXISTS "Masters can view QuickBooks connection" ON quickbooks_connection;
CREATE POLICY "Users can view company QB connection"
  ON quickbooks_connection FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- quickbooks_export_log
DROP POLICY IF EXISTS "Master users can view QB export log" ON quickbooks_export_log;
CREATE POLICY "Users can view company QB export log"
  ON quickbooks_export_log FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- quickbooks_settings
DROP POLICY IF EXISTS "Master users can view QB settings" ON quickbooks_settings;
CREATE POLICY "Users can view company QB settings"
  ON quickbooks_settings FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- staff_time_entries (has company_id)
DROP POLICY IF EXISTS "Users view own, manager and master view all time entries" ON staff_time_entries;
CREATE POLICY "Users can view company staff time entries"
  ON staff_time_entries FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid());

-- time_clock_reminders
DROP POLICY IF EXISTS "Master can view all time clock reminders" ON time_clock_reminders;
DROP POLICY IF EXISTS "Users can view own time clock reminders" ON time_clock_reminders;
CREATE POLICY "Users can view company time clock reminders"
  ON time_clock_reminders FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid());

-- time_entry_audit_log
DROP POLICY IF EXISTS "Master can view audit logs" ON time_entry_audit_log;
CREATE POLICY "Users can view company audit logs"
  ON time_entry_audit_log FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- yacht_history_logs (has company_id)
DROP POLICY IF EXISTS "Owners can view logs for their yacht" ON yacht_history_logs;
DROP POLICY IF EXISTS "Staff can view all history logs" ON yacht_history_logs;
CREATE POLICY "Users can view company yacht history logs"
  ON yacht_history_logs FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- yacht_smart_devices
DROP POLICY IF EXISTS "Master can view all devices" ON yacht_smart_devices;
CREATE POLICY "Users can view company smart devices"
  ON yacht_smart_devices FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- === Tables that use user_profiles.company_id directly instead of get_user_company_id() ===

-- daily_tasks
DROP POLICY IF EXISTS "Master and manager can view all company daily tasks" ON daily_tasks;
DROP POLICY IF EXISTS "Staff and mechanic can view all company daily tasks" ON daily_tasks;
CREATE POLICY "Users can view company daily tasks"
  ON daily_tasks FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- inspection_photos (has company_id with master bypass)
DROP POLICY IF EXISTS "Staff and masters can view inspection photos" ON inspection_photos;
CREATE POLICY "Users can view company inspection photos"
  ON inspection_photos FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

-- support_tickets (uses user_profiles.company_id directly)
DROP POLICY IF EXISTS "Owners, Managers, and Masters can view tickets" ON support_tickets;
CREATE POLICY "Users can view company support tickets"
  ON support_tickets FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR user_id = auth.uid());

-- yacht_documents (masters bypass company check - filter via yacht)
DROP POLICY IF EXISTS "Users can view documents for their accessible yachts" ON yacht_documents;
CREATE POLICY "Users can view company yacht documents"
  ON yacht_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yachts y
      WHERE y.id = yacht_documents.yacht_id
      AND y.company_id = get_user_company_id()
    )
  );

-- === Tables without company_id - filter via parent table ===

-- owner_handoff_inspections (has yacht_id)
DROP POLICY IF EXISTS "Users can view owner handoff inspections" ON owner_handoff_inspections;
CREATE POLICY "Users can view company handoff inspections"
  ON owner_handoff_inspections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yachts y
      WHERE y.id = owner_handoff_inspections.yacht_id
      AND y.company_id = get_user_company_id()
    )
  );

-- smart_lock_command_logs (has yacht_id, no company_id)
DROP POLICY IF EXISTS "Staff can view command logs" ON smart_lock_command_logs;
DROP POLICY IF EXISTS "Users can view command logs for their yacht" ON smart_lock_command_logs;
CREATE POLICY "Users can view company command logs"
  ON smart_lock_command_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yachts y
      WHERE y.id = smart_lock_command_logs.yacht_id
      AND y.company_id = get_user_company_id()
    )
  );

-- marine_wholesale_parts (no company_id column - these are shared parts, keep as-is)
-- This table doesn't have company_id, it's a shared catalog

-- repair_request_approval_tokens (keep anon access for public approval links)
DROP POLICY IF EXISTS "Allow staff and master to view all tokens" ON repair_request_approval_tokens;
CREATE POLICY "Staff can view company approval tokens"
  ON repair_request_approval_tokens FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    OR (company_id IS NULL AND EXISTS (
      SELECT 1 FROM repair_requests rr
      WHERE rr.id = repair_request_approval_tokens.repair_request_id
      AND rr.submitted_by = auth.uid()
    ))
  );
