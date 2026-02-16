/*
  # Add Deposit Confirmation Email Tracking

  1. Changes
    - Add `deposit_confirmation_email_sent_at` column to track when confirmation email was sent after payment
    - Add `deposit_confirmation_resend_id` column to store the Resend email ID for tracking
    
  2. Purpose
    - Track whether deposit confirmation emails were successfully sent
    - Allow staff to verify email delivery
    - Store Resend email ID for tracking delivery status
*/

-- Add deposit confirmation email tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repair_requests' AND column_name = 'deposit_confirmation_email_sent_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN deposit_confirmation_email_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'repair_requests' AND column_name = 'deposit_confirmation_resend_id'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN deposit_confirmation_resend_id text;
  END IF;
END $$;

COMMENT ON COLUMN repair_requests.deposit_confirmation_email_sent_at IS 'Timestamp when deposit confirmation email was sent to customer after payment';
COMMENT ON COLUMN repair_requests.deposit_confirmation_resend_id IS 'Resend email ID for deposit confirmation email';