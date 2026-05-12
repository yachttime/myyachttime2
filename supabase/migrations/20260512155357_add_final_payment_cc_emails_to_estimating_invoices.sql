/*
  # Add CC email tracking to estimating invoices

  Stores the CC addresses used when a payment link email is sent, so
  the UI can show which addresses received a carbon-copy of the email.

  1. New Column
    - `final_payment_cc_emails` (text[]) — array of CC email addresses
      included on the payment link send
*/

ALTER TABLE estimating_invoices
  ADD COLUMN IF NOT EXISTS final_payment_cc_emails text[] DEFAULT NULL;
