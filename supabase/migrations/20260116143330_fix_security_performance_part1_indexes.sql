/*
  # Security and Performance Fixes - Part 1: Indexes

  1. Performance Improvements
    - Add indexes on all unindexed foreign keys across 34 foreign key columns
    - Improves JOIN performance and query optimization

  2. Tables Modified
    - admin_notifications (2 indexes)
    - appointments (1 index)
    - education_videos (1 index)
    - maintenance_requests (3 indexes)
    - owner_chat_messages (1 index)
    - owner_handoff_inspections (2 indexes)
    - repair_requests (3 indexes)
    - smart_lock_access_logs (2 indexes)
    - smart_lock_command_logs (1 index)
    - staff_messages (2 indexes)
    - trip_inspections (3 indexes)
    - tuya_device_credentials (1 index)
    - vessel_management_agreements (3 indexes)
    - video_uploads (1 index)
    - yacht_budgets (2 indexes)
    - yacht_documents (1 index)
    - yacht_history_logs (2 indexes)
    - yacht_invoices (2 indexes)
    - yachts (1 index)
*/

-- admin_notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_completed_by ON public.admin_notifications(completed_by);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON public.admin_notifications(user_id);

-- appointments
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON public.appointments(created_by);

-- education_videos
CREATE INDEX IF NOT EXISTS idx_education_videos_yacht_id ON public.education_videos(yacht_id);

-- maintenance_requests
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_assigned_to ON public.maintenance_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_user_id ON public.maintenance_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_yacht_id ON public.maintenance_requests(yacht_id);

-- owner_chat_messages
CREATE INDEX IF NOT EXISTS idx_owner_chat_messages_user_id ON public.owner_chat_messages(user_id);

-- owner_handoff_inspections
CREATE INDEX IF NOT EXISTS idx_owner_handoff_inspections_inspector_id ON public.owner_handoff_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_owner_handoff_inspections_yacht_id ON public.owner_handoff_inspections(yacht_id);

-- repair_requests
CREATE INDEX IF NOT EXISTS idx_repair_requests_approved_by ON public.repair_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_repair_requests_billed_by ON public.repair_requests(billed_by);
CREATE INDEX IF NOT EXISTS idx_repair_requests_completed_by ON public.repair_requests(completed_by);

-- smart_lock_access_logs
CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_user_id ON public.smart_lock_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_yacht_id ON public.smart_lock_access_logs(yacht_id);

-- smart_lock_command_logs
CREATE INDEX IF NOT EXISTS idx_smart_lock_command_logs_yacht_id ON public.smart_lock_command_logs(yacht_id);

-- staff_messages
CREATE INDEX IF NOT EXISTS idx_staff_messages_completed_by ON public.staff_messages(completed_by);
CREATE INDEX IF NOT EXISTS idx_staff_messages_created_by ON public.staff_messages(created_by);

-- trip_inspections
CREATE INDEX IF NOT EXISTS idx_trip_inspections_booking_id ON public.trip_inspections(booking_id);
CREATE INDEX IF NOT EXISTS idx_trip_inspections_inspector_id ON public.trip_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_trip_inspections_yacht_id ON public.trip_inspections(yacht_id);

-- tuya_device_credentials
CREATE INDEX IF NOT EXISTS idx_tuya_device_credentials_created_by ON public.tuya_device_credentials(created_by);

-- vessel_management_agreements
CREATE INDEX IF NOT EXISTS idx_vessel_management_agreements_approved_by ON public.vessel_management_agreements(approved_by);
CREATE INDEX IF NOT EXISTS idx_vessel_management_agreements_pdf_document_id ON public.vessel_management_agreements(pdf_document_id);
CREATE INDEX IF NOT EXISTS idx_vessel_management_agreements_submitted_by ON public.vessel_management_agreements(submitted_by);

-- video_uploads
CREATE INDEX IF NOT EXISTS idx_video_uploads_yacht_id ON public.video_uploads(yacht_id);

-- yacht_budgets
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_created_by ON public.yacht_budgets(created_by);
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_updated_by ON public.yacht_budgets(updated_by);

-- yacht_documents
CREATE INDEX IF NOT EXISTS idx_yacht_documents_uploaded_by ON public.yacht_documents(uploaded_by);

-- yacht_history_logs
CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_created_by ON public.yacht_history_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_yacht_id ON public.yacht_history_logs(yacht_id);

-- yacht_invoices
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_completed_by ON public.yacht_invoices(completed_by);
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_repair_request_id ON public.yacht_invoices(repair_request_id);

-- yachts
CREATE INDEX IF NOT EXISTS idx_yachts_owner_id ON public.yachts(owner_id);