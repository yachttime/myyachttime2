/*
  # Add per-recipient email tracking to estimating_invoices

  ## Problem
  When a payment request email is sent to multiple recipients (managers),
  a single Resend API call was used with multiple `to:` addresses. This generates
  one email_id for the whole batch. When Resend fires delivery/open/click webhooks,
  there's no way to attribute which recipient engaged, and only the first webhook
  event gets stored (subsequent ones are ignored since the field is already set).

  ## Solution
  - Add `final_payment_resend_email_ids` (text[]) — stores one Resend ID per recipient
  - Add `final_payment_recipient_engagement` (jsonb) — stores per-recipient engagement
    as: { "email@example.com": { "delivered_at": "...", "opened_at": "...", "clicked_at": "..." } }

  ## New Columns on `estimating_invoices`
  - `final_payment_resend_email_ids` (text[]) — array of Resend email IDs, one per recipient
  - `final_payment_recipient_engagement` (jsonb) — per-recipient engagement object
*/

ALTER TABLE estimating_invoices
  ADD COLUMN IF NOT EXISTS final_payment_resend_email_ids text[],
  ADD COLUMN IF NOT EXISTS final_payment_recipient_engagement jsonb DEFAULT '{}'::jsonb;
