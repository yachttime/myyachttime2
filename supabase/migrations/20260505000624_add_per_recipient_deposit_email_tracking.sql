/*
  # Add per-recipient deposit email tracking to repair_requests

  ## Problem
  Deposit emails sent to multiple billing managers used a single Resend API call
  with all addresses in `to:`, generating one email_id. Engagement webhooks only
  updated the first event received, so only one manager showed engagement.

  ## Solution
  - `deposit_resend_email_ids` (text[]) — one Resend ID per recipient
  - `deposit_recipient_engagement` (jsonb) — per-email engagement map
    e.g. { "manager@email.com": { "delivered_at": "...", "opened_at": "..." } }
*/

ALTER TABLE repair_requests
  ADD COLUMN IF NOT EXISTS deposit_resend_email_ids text[],
  ADD COLUMN IF NOT EXISTS deposit_recipient_engagement jsonb DEFAULT '{}'::jsonb;
