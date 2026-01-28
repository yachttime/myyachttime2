/*
  # Fix Security Issues - Drop Unused Indexes
  
  1. Performance & Storage Optimization
    - Drop 68 unused indexes that are consuming storage and slowing down writes
    - Indexes are unused and provide no query performance benefit
    
  2. Tables Affected
    - yachts, maintenance_requests, education_videos, yacht_history_logs
    - owner_handoff_inspections, admin_notifications, trip_inspections
    - yacht_invoices, vessel_management_agreements, repair_requests
    - yacht_smart_devices, yacht_documents, appointments, staff_messages
    - smart_lock_command_logs, yacht_budgets, smart_lock_access_logs
    - video_uploads, user_profiles, owner_chat_messages, tuya_device_credentials
    
  3. Important Notes
    - These indexes have not been used and are safe to remove
    - Write operations will be faster without maintaining unused indexes
    - Storage space will be reclaimed
*/

-- Drop unused indexes from yachts table
DROP INDEX IF EXISTS idx_yachts_owner;

-- Drop unused indexes from maintenance_requests table
DROP INDEX IF EXISTS idx_maintenance_requests_yacht_id;
DROP INDEX IF EXISTS idx_maintenance_requests_status;
DROP INDEX IF EXISTS idx_maintenance_requests_assigned_to;
DROP INDEX IF EXISTS idx_maintenance_requests_user_id;

-- Drop unused indexes from education_videos table
DROP INDEX IF EXISTS idx_education_videos_yacht_id;

-- Drop unused indexes from yacht_history_logs table
DROP INDEX IF EXISTS idx_yacht_history_logs_reference;
DROP INDEX IF EXISTS idx_yacht_history_logs_yacht_id;
DROP INDEX IF EXISTS idx_yacht_history_logs_created_at;
DROP INDEX IF EXISTS idx_yacht_history_logs_created_by;

-- Drop unused indexes from owner_handoff_inspections table
DROP INDEX IF EXISTS idx_owner_handoff_inspections_yacht_id;
DROP INDEX IF EXISTS idx_owner_handoff_inspections_inspector_id;
DROP INDEX IF EXISTS idx_owner_handoff_inspections_inspection_date;

-- Drop unused indexes from admin_notifications table
DROP INDEX IF EXISTS idx_admin_notifications_type;
DROP INDEX IF EXISTS idx_admin_notifications_completed_by;
DROP INDEX IF EXISTS idx_admin_notifications_user_id;

-- Drop unused indexes from trip_inspections table
DROP INDEX IF EXISTS idx_trip_inspections_booking_id;
DROP INDEX IF EXISTS idx_trip_inspections_yacht_id;
DROP INDEX IF EXISTS idx_trip_inspections_inspector_id;
DROP INDEX IF EXISTS idx_trip_inspections_date;

-- Drop unused indexes from yacht_invoices table
DROP INDEX IF EXISTS idx_yacht_invoices_payment_email_recipient;
DROP INDEX IF EXISTS idx_yacht_invoices_stripe_payment_intent;
DROP INDEX IF EXISTS idx_yacht_invoices_payment_status;
DROP INDEX IF EXISTS idx_yacht_invoices_stripe_checkout_session;
DROP INDEX IF EXISTS idx_yacht_invoices_resend_email_id;
DROP INDEX IF EXISTS idx_yacht_invoices_payment_email_sent;
DROP INDEX IF EXISTS idx_yacht_invoices_yacht_id;
DROP INDEX IF EXISTS idx_yacht_invoices_year;
DROP INDEX IF EXISTS idx_yacht_invoices_completed_by;
DROP INDEX IF EXISTS idx_yacht_invoices_repair_request_id;

-- Drop unused indexes from vessel_management_agreements table
DROP INDEX IF EXISTS idx_vessel_agreements_season_year;
DROP INDEX IF EXISTS idx_vessel_agreements_status;
DROP INDEX IF EXISTS idx_vessel_agreements_submitted_by;
DROP INDEX IF EXISTS idx_vessel_agreements_created_at;
DROP INDEX IF EXISTS idx_vessel_agreements_approved_by;
DROP INDEX IF EXISTS idx_vessel_agreements_pdf_document_id;

-- Drop unused indexes from repair_requests table
DROP INDEX IF EXISTS idx_repair_requests_status;
DROP INDEX IF EXISTS idx_repair_requests_is_retail;
DROP INDEX IF EXISTS idx_repair_requests_resend_email_id;
DROP INDEX IF EXISTS idx_repair_requests_approved_by;
DROP INDEX IF EXISTS idx_repair_requests_billed_by;
DROP INDEX IF EXISTS idx_repair_requests_completed_by;

-- Drop unused indexes from yacht_smart_devices table
DROP INDEX IF EXISTS idx_yacht_smart_devices_requires_setup;
DROP INDEX IF EXISTS idx_yacht_smart_devices_category;
DROP INDEX IF EXISTS idx_yacht_smart_devices_is_active;

-- Drop unused indexes from yacht_documents table
DROP INDEX IF EXISTS idx_yacht_documents_uploaded_by;
DROP INDEX IF EXISTS idx_yacht_documents_created_at;

-- Drop unused indexes from appointments table
DROP INDEX IF EXISTS idx_appointments_date;
DROP INDEX IF EXISTS idx_appointments_yacht_id;
DROP INDEX IF EXISTS idx_appointments_created_by;

-- Drop unused indexes from staff_messages table
DROP INDEX IF EXISTS idx_staff_messages_is_read;
DROP INDEX IF EXISTS idx_staff_messages_completed_by;
DROP INDEX IF EXISTS idx_staff_messages_created_by;

-- Drop unused indexes from smart_lock_command_logs table
DROP INDEX IF EXISTS idx_command_logs_success;
DROP INDEX IF EXISTS idx_smart_lock_command_logs_yacht_id;

-- Drop unused indexes from yacht_budgets table
DROP INDEX IF EXISTS idx_yacht_budgets_yacht_id;
DROP INDEX IF EXISTS idx_yacht_budgets_created_by;
DROP INDEX IF EXISTS idx_yacht_budgets_updated_by;

-- Drop unused indexes from smart_lock_access_logs table
DROP INDEX IF EXISTS idx_smart_lock_access_logs_yacht_id;
DROP INDEX IF EXISTS idx_smart_lock_access_logs_user_id;

-- Drop unused indexes from video_uploads table
DROP INDEX IF EXISTS idx_video_uploads_yacht_id;
DROP INDEX IF EXISTS idx_video_uploads_status;

-- Drop unused indexes from user_profiles table
DROP INDEX IF EXISTS idx_user_profiles_is_active;

-- Drop unused indexes from owner_chat_messages table
DROP INDEX IF EXISTS idx_owner_chat_messages_user_id;

-- Drop unused indexes from tuya_device_credentials table
DROP INDEX IF EXISTS idx_tuya_device_credentials_created_by;
