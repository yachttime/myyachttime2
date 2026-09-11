/*
  # Create Salvage Report Email Log Table

  ## Purpose
  Track every email sent for a salvage report, not just the most recent one.
  Each row represents one email send event with its own Resend ID and engagement
  tracking (delivered, opened, clicked, bounced).

  ## New Table: salvage_report_email_logs
  - `id` (uuid PK)
  - `salvage_report_id` (uuid, FK to salvage_reports, NOT NULL)
  - `company_id` (uuid, FK to companies, nullable)
  - `sent_by` (uuid, FK to user_profiles, nullable) -- who sent the email
  - `sent_by_name` (text, nullable) -- display name of sender
  - `recipient_emails` (text, NOT NULL) -- comma-separated "to" list
  - `cc_emails` (text, nullable) -- comma-separated "cc" list
  - `subject` (text, nullable) -- email subject line
  - `message` (text, nullable) -- personal message included in the email
  - `resend_email_id` (text, nullable) -- Resend ID for webhook engagement tracking
  - `sent_at` (timestamptz, NOT NULL, default now())
  - `delivered_at` (timestamptz, nullable)
  - `opened_at` (timestamptz, nullable)
  - `clicked_at` (timestamptz, nullable)
  - `bounced_at` (timestamptz, nullable)
  - `open_count` (int, default 0)
  - `click_count` (int, default 0)

  ## Security
  - RLS enabled, scoped to company_id matching the user's company (same pattern as salvage_reports).
  - Staff/master/manager/mechanic can read and insert within their company.

  ## Notes
  - The existing columns on salvage_reports (email_sent_at, email_resend_id, etc.)
    remain as a "last email" summary. The log table provides full history.
*/

CREATE TABLE IF NOT EXISTS salvage_report_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salvage_report_id uuid NOT NULL REFERENCES salvage_reports(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  sent_by_name text,
  recipient_emails text NOT NULL,
  cc_emails text,
  subject text,
  message text,
  resend_email_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  open_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0
);

ALTER TABLE salvage_report_email_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_salvage_email_logs_report_id ON salvage_report_email_logs(salvage_report_id);
CREATE INDEX IF NOT EXISTS idx_salvage_email_logs_resend_id ON salvage_report_email_logs(resend_email_id);

DROP POLICY IF EXISTS "select_salvage_email_logs" ON salvage_report_email_logs;
CREATE POLICY "select_salvage_email_logs"
ON salvage_report_email_logs FOR SELECT
TO authenticated
USING (
  company_id IS NULL OR company_id = get_user_company_id()
);

DROP POLICY IF EXISTS "insert_salvage_email_logs" ON salvage_report_email_logs;
CREATE POLICY "insert_salvage_email_logs"
ON salvage_report_email_logs FOR INSERT
TO authenticated
WITH CHECK (
  company_id IS NULL OR company_id = get_user_company_id()
);

DROP POLICY IF EXISTS "update_salvage_email_logs" ON salvage_report_email_logs;
CREATE POLICY "update_salvage_email_logs"
ON salvage_report_email_logs FOR UPDATE
TO authenticated
USING (
  company_id IS NULL OR company_id = get_user_company_id()
)
WITH CHECK (
  company_id IS NULL OR company_id = get_user_company_id()
);

DROP POLICY IF EXISTS "delete_salvage_email_logs" ON salvage_report_email_logs;
CREATE POLICY "delete_salvage_email_logs"
ON salvage_report_email_logs FOR DELETE
TO authenticated
USING (
  company_id IS NULL OR company_id = get_user_company_id()
);
