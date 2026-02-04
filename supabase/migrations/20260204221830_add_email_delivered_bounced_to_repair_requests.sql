/*
  # Add Email Delivery Tracking to Repair Requests

  1. Changes to `repair_requests` table
    - Add `email_delivered_at` (timestamptz) - When approval email was delivered
    - Add `email_bounced_at` (timestamptz) - When approval email bounced
    - Add `email_open_count` (integer) - Count of times email was opened
    - Add `email_click_count` (integer) - Count of times links were clicked
    - Add `email_bounce_count` (integer) - Count of bounce events

  2. Purpose
    - Track approval email delivery status (not just estimate emails)
    - Monitor email engagement for approval notifications
    - Match the tracking available for yacht_invoices and staff_messages
    - Enable proper email status badges in the UI

  3. Notes
    - These fields track the APPROVAL notification emails sent to managers
    - The estimate_email_* fields track emails sent to retail customers
    - Both types of emails can now show delivery status badges
*/

-- Add email tracking fields to repair_requests table
DO $$
BEGIN
  -- Add email_delivered_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_delivered_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_delivered_at timestamptz;
  END IF;

  -- Add email_bounced_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_bounced_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_bounced_at timestamptz;
  END IF;

  -- Add email_open_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_open_count'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_open_count integer DEFAULT 0;
  END IF;

  -- Add email_click_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_click_count'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_click_count integer DEFAULT 0;
  END IF;

  -- Add email_bounce_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_bounce_count'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_bounce_count integer DEFAULT 0;
  END IF;
END $$;
