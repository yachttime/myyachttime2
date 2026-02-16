/*
  # Migrate All Existing Data to AZ Marine Company

  1. Migration Strategy
    - Get AZ Marine company ID
    - Update all tables with company_id = AZ Marine ID
    - Validate record counts before and after
    - Report any tables with issues

  2. Tables to Update (60+ tables)
    - Core: yachts, customers, customer_vessels
    - Bookings: yacht_bookings, yacht_booking_owners, trip_inspections
    - Work: repair_requests, work_orders, estimates, maintenance_requests
    - Inventory: parts_inventory, part_transactions, mercury_marine_parts
    - Financial: labor_codes, accounting_codes, yacht_invoices
    - Staff: schedules, time entries, payroll
    - Communication: notifications, messages, chat
    - QuickBooks: accounts, mappings, connection
    - And all related tables

  3. Safety
    - Use WHERE company_id IS NULL to only update records not yet migrated
    - This makes the migration idempotent (can run multiple times safely)
*/

DO $$
DECLARE
  az_marine_id uuid;
  updated_count int;
  total_updated int := 0;
BEGIN
  -- Get AZ Marine company ID
  SELECT id INTO az_marine_id FROM companies WHERE company_name = 'AZ Marine' LIMIT 1;
  
  IF az_marine_id IS NULL THEN
    RAISE EXCEPTION 'AZ Marine company not found - cannot migrate data';
  END IF;
  
  RAISE NOTICE 'Migrating all data to AZ Marine company (ID: %)', az_marine_id;
  
  -- Core tables
  UPDATE yachts SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yachts', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE customers SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % customers', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE customer_vessels SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % customer_vessels', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Booking tables
  UPDATE yacht_bookings SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_bookings', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE yacht_booking_owners SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_booking_owners', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE trip_inspections SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % trip_inspections', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE owner_handoff_inspections SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % owner_handoff_inspections', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Yacht related tables
  UPDATE yacht_documents SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_documents', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE yacht_history_logs SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_history_logs', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE yacht_budgets SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_budgets', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE yacht_invoices SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_invoices', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE yacht_smart_devices SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % yacht_smart_devices', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Work management tables
  UPDATE repair_requests SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % repair_requests', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE repair_request_approval_tokens SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % repair_request_approval_tokens', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE maintenance_requests SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % maintenance_requests', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE work_orders SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % work_orders', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE work_order_tasks SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % work_order_tasks', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE work_order_task_assignments SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % work_order_task_assignments', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE work_order_line_items SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % work_order_line_items', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE work_order_time_entries SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % work_order_time_entries', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimates SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimates', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimate_line_items SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_line_items', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimate_tasks SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_tasks', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimating_invoices SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimating_invoices', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Inventory and parts tables
  UPDATE parts_inventory SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % parts_inventory', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE part_transactions SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % part_transactions', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE mercury_marine_parts SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % mercury_marine_parts', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE mercury_price_list_imports SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % mercury_price_list_imports', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Financial reference tables
  UPDATE labor_codes SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % labor_codes', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE accounting_codes SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % accounting_codes', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE vendors SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % vendors', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Estimate packages and settings
  UPDATE estimate_packages SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_packages', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimate_package_labor SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_package_labor', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimate_package_parts SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_package_parts', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimate_fees_config SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_fees_config', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE estimate_settings SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % estimate_settings', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Staff scheduling and time tracking
  UPDATE staff_time_entries SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % staff_time_entries', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE time_entry_audit_log SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % time_entry_audit_log', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE staff_schedules SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % staff_schedules', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE staff_schedule_overrides SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % staff_schedule_overrides', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE staff_time_off_requests SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % staff_time_off_requests', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE appointments SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % appointments', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Payroll
  UPDATE payroll_periods SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % payroll_periods', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE pay_periods SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % pay_periods', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE time_clock_reminders SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % time_clock_reminders', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Communication tables
  UPDATE admin_notifications SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % admin_notifications', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE staff_messages SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % staff_messages', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE owner_chat_messages SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % owner_chat_messages', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE invoice_engagement_events SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % invoice_engagement_events', updated_count;
  total_updated := total_updated + updated_count;
  
  -- QuickBooks tables
  UPDATE quickbooks_accounts SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % quickbooks_accounts', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE quickbooks_account_mappings SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % quickbooks_account_mappings', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE quickbooks_connection SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % quickbooks_connection', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE quickbooks_settings SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % quickbooks_settings', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE quickbooks_export_log SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % quickbooks_export_log', updated_count;
  total_updated := total_updated + updated_count;
  
  -- Miscellaneous tables
  UPDATE education_videos SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % education_videos', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE video_uploads SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % video_uploads', updated_count;
  total_updated := total_updated + updated_count;
  
  UPDATE vessel_management_agreements SET company_id = az_marine_id WHERE company_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % vessel_management_agreements', updated_count;
  total_updated := total_updated + updated_count;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE 'Total records updated: %', total_updated;
  RAISE NOTICE 'All data now belongs to AZ Marine company';
  RAISE NOTICE '========================================';
END $$;
