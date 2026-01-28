/*
  # Add Payment Confirmation Email Tracking

  1. Changes to yacht_invoices table
    - Add payment_confirmation_email_sent_at column to track when confirmation email was sent
    - Add payment_confirmation_resend_id column to store Resend email ID for tracking

  2. Purpose
    - Track payment confirmation emails sent to customers after successful payment
    - Enable email engagement tracking for payment confirmations
    - Helps staff verify customer received payment confirmation
*/

-- Add payment confirmation email tracking columns
DO $$
BEGIN
  -- Add payment_confirmation_email_sent_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_confirmation_email_sent_at'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_confirmation_email_sent_at timestamptz;
  END IF;

  -- Add payment_confirmation_resend_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_confirmation_resend_id'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_confirmation_resend_id text;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN yacht_invoices.payment_confirmation_email_sent_at IS 'Timestamp when payment confirmation email was sent to customer';
COMMENT ON COLUMN yacht_invoices.payment_confirmation_resend_id IS 'Resend email ID for payment confirmation tracking';