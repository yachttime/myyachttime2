/*
  # Add payment_email_all_recipients to yacht_invoices

  ## Summary
  Adds an array column to store all recipient emails when a payment link email
  is sent for a yacht invoice. Previously only the primary recipient was stored,
  so when multiple managers were CC'd the UI could only show one address.

  ## Changes
  - `yacht_invoices`: new column `payment_email_all_recipients text[]` — stores every
    email address the payment-link email was sent/CC'd to
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_email_all_recipients'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_email_all_recipients text[];
  END IF;
END $$;
