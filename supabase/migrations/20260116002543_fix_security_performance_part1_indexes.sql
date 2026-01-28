/*
  # Fix Security and Performance Issues - Part 1: Indexes

  ## Performance Improvements
  
  Add indexes for all unindexed foreign key columns across all tables.
  This significantly improves JOIN performance and foreign key constraint checks.
*/

-- admin_notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_completed_by ON public.admin_notifications(completed_by);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON public.admin_notifications(user_id);

-- appointments
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON public.appointments(created_by);

-- maintenance_requests
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_assigned_to ON public.maintenance_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_user_id ON public.maintenance_requests(user_id);

-- owner_chat_messages
CREATE INDEX IF NOT EXISTS idx_owner_chat_messages_user_id ON public.owner_chat_messages(user_id);

-- repair_requests
CREATE INDEX IF NOT EXISTS idx_repair_requests_approved_by ON public.repair_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_repair_requests_billed_by ON public.repair_requests(billed_by);
CREATE INDEX IF NOT EXISTS idx_repair_requests_completed_by ON public.repair_requests(completed_by);
CREATE INDEX IF NOT EXISTS idx_repair_requests_submitted_by ON public.repair_requests(submitted_by);

-- smart_lock_command_logs
CREATE INDEX IF NOT EXISTS idx_smart_lock_command_logs_yacht_id ON public.smart_lock_command_logs(yacht_id);

-- staff_messages
CREATE INDEX IF NOT EXISTS idx_staff_messages_completed_by ON public.staff_messages(completed_by);
CREATE INDEX IF NOT EXISTS idx_staff_messages_created_by ON public.staff_messages(created_by);

-- tuya_device_credentials
CREATE INDEX IF NOT EXISTS idx_tuya_device_credentials_created_by ON public.tuya_device_credentials(created_by);

-- vessel_management_agreements
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_approved_by ON public.vessel_management_agreements(approved_by);
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_pdf_document_id ON public.vessel_management_agreements(pdf_document_id);

-- yacht_budgets
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_created_by ON public.yacht_budgets(created_by);
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_updated_by ON public.yacht_budgets(updated_by);

-- yacht_history_logs
CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_created_by ON public.yacht_history_logs(created_by);

-- yacht_invoices
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_completed_by ON public.yacht_invoices(completed_by);
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_repair_request_id ON public.yacht_invoices(repair_request_id);
