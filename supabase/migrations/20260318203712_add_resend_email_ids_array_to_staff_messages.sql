/*
  # Add resend_email_ids array to staff_messages

  ## Summary
  When a bulk email is sent to multiple recipients, Resend needs one API call per
  recipient to enable per-recipient open/click tracking. This migration adds a
  `resend_email_ids` text array column to store all individual email IDs returned
  by Resend's batch send, alongside the existing `resend_email_id` (kept for
  backwards compatibility with single-recipient emails).

  ## Changes
  - `staff_messages`: Add `resend_email_ids` (text[]) column to store multiple
    Resend email IDs when sending to multiple recipients
  - Add a GIN index for fast array element lookup used by the webhook handler
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'resend_email_ids'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN resend_email_ids text[];
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_messages_resend_email_ids
  ON staff_messages USING GIN (resend_email_ids);
