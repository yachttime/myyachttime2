/*
  # Add per-recipient email tracking to yacht_invoices

  ## Summary
  Adds two columns to support per-recipient email engagement tracking when a
  payment-link email is sent to multiple recipients (primary + CC'd addresses).

  ## New Columns on `yacht_invoices`
  - `payment_resend_email_ids` (text[]) — one Resend email ID per recipient,
    stored when the payment-link email is dispatched so the webhook can match
    each inbound event to the correct address.
  - `payment_recipient_engagement` (jsonb) — per-recipient engagement object,
    keyed by email address: { "addr@example.com": { "delivered_at": "...",
    "opened_at": "...", "clicked_at": "...", "bounced_at": "..." } }
*/

ALTER TABLE yacht_invoices
  ADD COLUMN IF NOT EXISTS payment_resend_email_ids text[],
  ADD COLUMN IF NOT EXISTS payment_recipient_engagement jsonb DEFAULT '{}'::jsonb;
