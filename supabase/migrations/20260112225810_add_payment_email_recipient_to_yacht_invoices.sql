/*
  # Add Payment Email Recipient Tracking

  1. Changes to yacht_invoices table
    - Add payment_email_recipient column to store the email address where the payment link was sent

  2. Purpose
    - Display the recipient email in the email engagement tracking section
    - Helps staff verify which email address received the payment link
*/

-- Add payment email recipient column
ALTER TABLE yacht_invoices
  ADD COLUMN IF NOT EXISTS payment_email_recipient text;

-- Add index for searching by recipient email
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_payment_email_recipient
  ON yacht_invoices(payment_email_recipient)
  WHERE payment_email_recipient IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN yacht_invoices.payment_email_recipient IS 'Email address where the payment link was sent';