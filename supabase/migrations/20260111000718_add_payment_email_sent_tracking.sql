/*
  # Add Payment Email Tracking to Yacht Invoices

  1. Overview
    - Adds tracking for when payment link emails are sent to customers
    - Enables differentiation between invoices that need to be billed vs those already sent
    - Improves visibility into the billing workflow status

  2. New Columns
    - `payment_email_sent_at` (timestamptz) - Timestamp when payment link email was sent to customer

  3. Changes
    - Adds nullable timestamp field to track email delivery
    - Adds index for efficient querying of sent/unsent invoices
    - NULL value indicates invoice needs to be billed
    - Non-NULL value indicates payment request has been sent to customer

  4. Notes
    - Existing invoices will have NULL payment_email_sent_at (need to be billed)
    - Edge function will update this field after successfully sending email
    - Used for UI status display logic
*/

-- Add payment email sent tracking column
DO $$
BEGIN
  -- Add payment_email_sent_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_email_sent_at'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_email_sent_at timestamptz;
  END IF;
END $$;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_payment_email_sent 
  ON yacht_invoices(payment_email_sent_at);
