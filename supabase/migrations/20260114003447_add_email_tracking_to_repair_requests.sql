/*
  # Add Email Tracking to Repair Requests

  1. Changes to `repair_requests` table
    - Add `estimate_email_sent_at` (timestamptz) - Timestamp when estimate email was sent
    - Add `resend_email_id` (text) - Resend email ID for tracking delivery status
    - Add `estimate_email_recipient` (text) - Email address where estimate was sent
    - Add `email_opened_at` (timestamptz) - When email was first opened
    - Add `email_clicked_at` (timestamptz) - When links in email were clicked

  2. Purpose
    - Track estimate email delivery to retail customers
    - Monitor email engagement (opens, clicks)
    - Ensure proper audit trail for customer communications
    - Follow same pattern as yacht_invoices email tracking

  3. Security
    - No RLS changes needed - existing policies cover these fields
    - Email tracking data only accessible by staff/managers
*/

-- Add email tracking fields to repair_requests table
DO $$
BEGIN
  -- Add estimate_email_sent_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'estimate_email_sent_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN estimate_email_sent_at timestamptz;
  END IF;

  -- Add resend_email_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN resend_email_id text;
  END IF;

  -- Add estimate_email_recipient column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'estimate_email_recipient'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN estimate_email_recipient text;
  END IF;

  -- Add email_opened_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_opened_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_opened_at timestamptz;
  END IF;

  -- Add email_clicked_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'email_clicked_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN email_clicked_at timestamptz;
  END IF;
END $$;

-- Add index for email tracking queries
CREATE INDEX IF NOT EXISTS idx_repair_requests_resend_email_id ON repair_requests(resend_email_id);
