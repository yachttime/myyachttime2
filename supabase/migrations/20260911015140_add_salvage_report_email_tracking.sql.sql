/*
  # Add Email Tracking to Salvage Reports

  1. Changes to `salvage_reports` table
    - `email_sent_at` (timestamptz, nullable) - When the report was last emailed
    - `email_recipients` (text, nullable) - Comma-separated list of "To" recipients
    - `email_cc_recipients` (text, nullable) - Comma-separated list of CC recipients
    - `email_resend_id` (text, nullable) - Resend email ID for tracking delivery/open status

  2. Security
    - No new policies needed — existing UPDATE policies on salvage_reports already
      allow staff/master to update these columns within their company scope.

  3. Notes
    - These columns are purely for tracking/display purposes so the report list
      can show an "Emailed" badge with the date and recipients.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_sent_at') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_recipients') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_recipients text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_cc_recipients') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_cc_recipients text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salvage_reports' AND column_name = 'email_resend_id') THEN
    ALTER TABLE salvage_reports ADD COLUMN email_resend_id text;
  END IF;
END $$;
