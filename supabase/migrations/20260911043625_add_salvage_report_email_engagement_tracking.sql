/*
  # Add Email Engagement Tracking to Salvage Reports

  ## Changes to `salvage_reports` table

  Adds columns to track email delivery, open, click, and bounce events
  received from Resend webhooks, mirroring the pattern used by
  yacht_invoices, repair_requests, estimating_invoices, and staff_messages.

  ### New columns:
  1. `email_delivered_at` (timestamptz, nullable) — Timestamp when Resend confirmed delivery
  2. `email_opened_at` (timestamptz, nullable) — Timestamp of first email open event
  3. `email_clicked_at` (timestamptz, nullable) — Timestamp of first link click in the email
  4. `email_bounced_at` (timestamptz, nullable) — Timestamp if the email bounced
  5. `email_open_count` (int, default 0) — Total count of email open events
  6. `email_click_count` (int, default 0) — Total count of email click events

  ## Security
  - No new policies needed — existing UPDATE policies on salvage_reports
    already allow staff/master to update these columns within their company scope.

  ## Notes
  - These columns are populated by the handle-resend-webhook edge function
    when Resend sends delivery/open/click/bounce events for salvage report emails.
  - The email_resend_id column (already present) is used to match incoming
    webhook events to the correct salvage report record.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_delivered_at') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_delivered_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_opened_at') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_opened_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_clicked_at') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_clicked_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_bounced_at') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_bounced_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_open_count') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_open_count int DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_click_count') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_click_count int DEFAULT 0;
  END IF;
END $$;
