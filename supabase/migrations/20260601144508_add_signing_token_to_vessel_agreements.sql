/*
  # Add Signing Token and Email Tracking to Vessel Management Agreements

  ## Summary
  Adds a secure one-time signing token system to vessel_management_agreements so
  that managers can sign agreements via a public link without needing a system account.
  Also adds full email engagement tracking (delivered, opened, clicked, bounced) to
  the signing email sent to the manager.

  ## New Columns on vessel_management_agreements

  ### Token Columns
  - `signing_token` (uuid, unique) — secret token that grants public access to sign this agreement
  - `signing_token_created_at` (timestamptz) — when the token was generated; used to enforce 30-day expiry
  - `signing_token_generated_by` (uuid, FK to user_profiles.user_id) — which master user generated the token

  ### Email Tracking Columns
  - `signing_email_sent_at` (timestamptz) — when the signing link email was sent
  - `signing_email_recipient` (text) — email address the signing link was sent to
  - `signing_email_resend_id` (text) — Resend message ID used by webhook to route events
  - `signing_email_delivered_at` (timestamptz) — set by Resend webhook on email.delivered
  - `signing_email_opened_at` (timestamptz) — set by Resend webhook on email.opened
  - `signing_email_clicked_at` (timestamptz) — set by Resend webhook on email.clicked
  - `signing_email_bounced_at` (timestamptz) — set by Resend webhook on email.bounced
  - `signing_email_open_count` (integer, default 0) — total opens
  - `signing_email_click_count` (integer, default 0) — total link clicks

  ## Security
  - Unique index on signing_token prevents token collisions
  - Existing RLS policies are untouched; new anon SELECT/UPDATE policies are added in a separate migration
*/

DO $$
BEGIN
  -- signing_token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_token'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_token uuid DEFAULT NULL;
  END IF;

  -- signing_token_created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_token_created_at'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_token_created_at timestamptz DEFAULT NULL;
  END IF;

  -- signing_token_generated_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_token_generated_by'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_token_generated_by uuid DEFAULT NULL;
  END IF;

  -- signing_email_sent_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_sent_at'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_sent_at timestamptz DEFAULT NULL;
  END IF;

  -- signing_email_recipient
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_recipient'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_recipient text DEFAULT NULL;
  END IF;

  -- signing_email_resend_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_resend_id'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_resend_id text DEFAULT NULL;
  END IF;

  -- signing_email_delivered_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_delivered_at'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_delivered_at timestamptz DEFAULT NULL;
  END IF;

  -- signing_email_opened_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_opened_at'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_opened_at timestamptz DEFAULT NULL;
  END IF;

  -- signing_email_clicked_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_clicked_at'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_clicked_at timestamptz DEFAULT NULL;
  END IF;

  -- signing_email_bounced_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_bounced_at'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_bounced_at timestamptz DEFAULT NULL;
  END IF;

  -- signing_email_open_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_open_count'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_open_count integer DEFAULT 0;
  END IF;

  -- signing_email_click_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'signing_email_click_count'
  ) THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN signing_email_click_count integer DEFAULT 0;
  END IF;
END $$;

-- Unique index on signing_token so no two agreements share the same token
CREATE UNIQUE INDEX IF NOT EXISTS vessel_agreements_signing_token_unique
  ON vessel_management_agreements (signing_token)
  WHERE signing_token IS NOT NULL;
