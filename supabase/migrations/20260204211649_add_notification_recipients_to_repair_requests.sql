/*
  # Add Notification Recipients to Repair Requests

  1. Changes to `repair_requests` table
    - Add `notification_recipients` (text) - Comma-separated list of email addresses that received the initial repair request notification

  2. Purpose
    - Track which staff/managers were notified when repair request was submitted
    - Provide transparency to users about who was notified
    - Audit trail for notifications

  3. Security
    - No RLS changes needed - existing policies cover this field
*/

-- Add notification_recipients column to repair_requests table
DO $$
BEGIN
  -- Add notification_recipients column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'notification_recipients'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN notification_recipients text;
  END IF;
END $$;