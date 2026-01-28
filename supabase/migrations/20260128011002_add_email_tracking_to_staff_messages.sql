/*
  # Add Email Tracking to Staff Messages

  1. Changes to `staff_messages` table
    - Add `email_subject` (text) - Subject line of the email
    - Add `email_body` (text) - Body content of the email sent
    - Add `email_recipients` (jsonb) - Array of recipient objects {email, name}
    - Add `email_cc_recipients` (text[]) - Array of CC email addresses
    - Add `yacht_name` (text) - Associated yacht name if applicable
    - Add `email_sent_at` (timestamptz) - Timestamp when email was sent
    - Add `resend_email_id` (text) - Resend email ID for tracking delivery status
    - Add `email_delivered_at` (timestamptz) - When email was delivered
    - Add `email_opened_at` (timestamptz) - When email was first opened
    - Add `email_clicked_at` (timestamptz) - When links in email were clicked
    - Add `email_bounced_at` (timestamptz) - When email bounced
    - Add `email_open_count` (integer) - Number of times email was opened
    - Add `email_click_count` (integer) - Number of times links were clicked

  2. Purpose
    - Track bulk email communications sent to yacht members
    - Monitor email engagement (opens, clicks)
    - Store copy of sent emails for audit trail
    - Follow same pattern as yacht_invoices and repair_requests email tracking

  3. Security
    - No RLS changes needed - existing policies cover these fields
    - Email tracking data only accessible by staff/managers
*/

-- Add email tracking fields to staff_messages table
DO $$
BEGIN
  -- Add email_subject column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_subject text;
  END IF;

  -- Add email_body column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_body'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_body text;
  END IF;

  -- Add email_recipients column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_recipients'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_recipients jsonb;
  END IF;

  -- Add email_cc_recipients column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_cc_recipients'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_cc_recipients text[];
  END IF;

  -- Add yacht_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'yacht_name'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN yacht_name text;
  END IF;

  -- Add email_sent_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_sent_at'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_sent_at timestamptz;
  END IF;

  -- Add resend_email_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN resend_email_id text;
  END IF;

  -- Add email_delivered_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_delivered_at'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_delivered_at timestamptz;
  END IF;

  -- Add email_opened_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_opened_at'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_opened_at timestamptz;
  END IF;

  -- Add email_clicked_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_clicked_at'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_clicked_at timestamptz;
  END IF;

  -- Add email_bounced_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_bounced_at'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_bounced_at timestamptz;
  END IF;

  -- Add email_open_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_open_count'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_open_count integer DEFAULT 0;
  END IF;

  -- Add email_click_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'email_click_count'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN email_click_count integer DEFAULT 0;
  END IF;
END $$;

-- Add index for email tracking queries
CREATE INDEX IF NOT EXISTS idx_staff_messages_resend_email_id ON staff_messages(resend_email_id) WHERE resend_email_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_messages_email_sent_at ON staff_messages(email_sent_at DESC) WHERE email_sent_at IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN staff_messages.resend_email_id IS 'Resend email ID for tracking engagement via webhooks';
COMMENT ON COLUMN staff_messages.email_open_count IS 'Number of times the email was opened';
COMMENT ON COLUMN staff_messages.email_click_count IS 'Number of times links in the email were clicked';
