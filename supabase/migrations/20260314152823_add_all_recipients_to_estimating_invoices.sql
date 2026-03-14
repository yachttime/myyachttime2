/*
  # Add all recipients tracking to estimating invoices

  ## Changes
  - Adds `final_payment_email_all_recipients` (text[]) column to store all email addresses
    the payment invoice was sent to (primary + additional billing managers)

  This allows the UI to show all recipients in the Email Engagement section,
  not just the primary recipient.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'final_payment_email_all_recipients'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN final_payment_email_all_recipients text[];
  END IF;
END $$;
