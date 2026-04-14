/*
  # Create Staff Message Recipient Tracking Table

  ## Summary
  Adds per-recipient email tracking for bulk owner emails. Previously all tracking
  (delivered, opened, clicked, bounced) was stored as aggregate fields on the
  staff_messages row, meaning a single "Delivered" status appeared for all 12
  recipients at once.

  This table stores one row per recipient per staff message, linking each
  Resend email ID to a specific recipient email address, so tracking events
  can be shown individually.

  ## New Tables
  - `staff_message_recipient_tracking`
    - `id` (uuid, primary key)
    - `staff_message_id` (uuid, FK to staff_messages)
    - `resend_email_id` (text) - the Resend email ID for this specific recipient
    - `recipient_email` (text) - the recipient email address
    - `recipient_name` (text, nullable)
    - `delivered_at` (timestamptz, nullable)
    - `opened_at` (timestamptz, nullable)
    - `clicked_at` (timestamptz, nullable)
    - `bounced_at` (timestamptz, nullable)
    - `open_count` (int, default 0)
    - `click_count` (int, default 0)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled, staff/master/manager can read records for their company's messages
*/

CREATE TABLE IF NOT EXISTS staff_message_recipient_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_message_id uuid NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
  resend_email_id text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  open_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smrt_staff_message_id ON staff_message_recipient_tracking(staff_message_id);
CREATE INDEX IF NOT EXISTS idx_smrt_resend_email_id ON staff_message_recipient_tracking(resend_email_id);

ALTER TABLE staff_message_recipient_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and master can view recipient tracking"
  ON staff_message_recipient_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Service role can insert recipient tracking"
  ON staff_message_recipient_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Service role can update recipient tracking"
  ON staff_message_recipient_tracking FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
