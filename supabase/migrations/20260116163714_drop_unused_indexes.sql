/*
  # Drop Unused Indexes

  1. Performance Optimization
    - Removes 33 unused indexes that consume storage and slow down writes
    - Indexes are not being used by queries and provide no benefit
    - This will improve INSERT/UPDATE/DELETE performance across multiple tables

  2. Affected Tables
    - admin_notifications: 2 indexes removed
    - appointments: 1 index removed
    - education_videos: 1 index removed
    - maintenance_requests: 3 indexes removed
    - owner_chat_messages: 1 index removed
    - owner_handoff_inspections: 2 indexes removed
    - repair_requests: 3 indexes removed
    - smart_lock_access_logs: 2 indexes removed
    - smart_lock_command_logs: 1 index removed
    - staff_messages: 2 indexes removed
    - trip_inspections: 3 indexes removed
    - tuya_device_credentials: 1 index removed
    - vessel_management_agreements: 3 indexes removed
    - video_uploads: 1 index removed
    - yacht_budgets: 2 indexes removed
    - yacht_documents: 1 index removed
    - yacht_history_logs: 2 indexes removed
    - yacht_invoices: 1 index removed
    - yachts: 1 index removed

  3. Important Notes
    - These indexes were identified as unused by Supabase's query analyzer
    - Dropping unused indexes reduces storage costs and improves write performance
    - If any of these become needed in the future, they can be recreated
*/

-- Drop unused indexes on admin_notifications
DROP INDEX IF EXISTS idx_admin_notifications_completed_by;
DROP INDEX IF EXISTS idx_admin_notifications_user_id;

-- Drop unused indexes on appointments
DROP INDEX IF EXISTS idx_appointments_created_by;

-- Drop unused indexes on education_videos
DROP INDEX IF EXISTS idx_education_videos_yacht_id;

-- Drop unused indexes on maintenance_requests
DROP INDEX IF EXISTS idx_maintenance_requests_assigned_to;
DROP INDEX IF EXISTS idx_maintenance_requests_user_id;
DROP INDEX IF EXISTS idx_maintenance_requests_yacht_id;

-- Drop unused indexes on owner_chat_messages
DROP INDEX IF EXISTS idx_owner_chat_messages_user_id;

-- Drop unused indexes on owner_handoff_inspections
DROP INDEX IF EXISTS idx_owner_handoff_inspections_inspector_id;
DROP INDEX IF EXISTS idx_owner_handoff_inspections_yacht_id;

-- Drop unused indexes on repair_requests
DROP INDEX IF EXISTS idx_repair_requests_approved_by;
DROP INDEX IF EXISTS idx_repair_requests_billed_by;
DROP INDEX IF EXISTS idx_repair_requests_completed_by;

-- Drop unused indexes on smart_lock_access_logs
DROP INDEX IF EXISTS idx_smart_lock_access_logs_user_id;
DROP INDEX IF EXISTS idx_smart_lock_access_logs_yacht_id;

-- Drop unused indexes on smart_lock_command_logs
DROP INDEX IF EXISTS idx_smart_lock_command_logs_yacht_id;

-- Drop unused indexes on staff_messages
DROP INDEX IF EXISTS idx_staff_messages_completed_by;
DROP INDEX IF EXISTS idx_staff_messages_created_by;

-- Drop unused indexes on trip_inspections
DROP INDEX IF EXISTS idx_trip_inspections_booking_id;
DROP INDEX IF EXISTS idx_trip_inspections_inspector_id;
DROP INDEX IF EXISTS idx_trip_inspections_yacht_id;

-- Drop unused indexes on tuya_device_credentials
DROP INDEX IF EXISTS idx_tuya_device_credentials_created_by;

-- Drop unused indexes on vessel_management_agreements
DROP INDEX IF EXISTS idx_vessel_management_agreements_approved_by;
DROP INDEX IF EXISTS idx_vessel_management_agreements_pdf_document_id;
DROP INDEX IF EXISTS idx_vessel_management_agreements_submitted_by;

-- Drop unused indexes on video_uploads
DROP INDEX IF EXISTS idx_video_uploads_yacht_id;

-- Drop unused indexes on yacht_budgets
DROP INDEX IF EXISTS idx_yacht_budgets_created_by;
DROP INDEX IF EXISTS idx_yacht_budgets_updated_by;

-- Drop unused indexes on yacht_documents
DROP INDEX IF EXISTS idx_yacht_documents_uploaded_by;

-- Drop unused indexes on yacht_history_logs
DROP INDEX IF EXISTS idx_yacht_history_logs_created_by;
DROP INDEX IF EXISTS idx_yacht_history_logs_yacht_id;

-- Drop unused indexes on yacht_invoices
DROP INDEX IF EXISTS idx_yacht_invoices_completed_by;

-- Drop unused indexes on yachts
DROP INDEX IF EXISTS idx_yachts_owner_id;
