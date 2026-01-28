/*
  # Add Reference ID to Admin Notifications

  1. Changes
    - Add `reference_id` column to admin_notifications table
    - This will store the ID of the related record (e.g., trip_inspection.id, repair_request.id)
    
  2. Purpose
    - Enables linking notifications to their source records
    - Allows displaying detailed information or PDFs from notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_notifications' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE admin_notifications ADD COLUMN reference_id uuid;
  END IF;
END $$;