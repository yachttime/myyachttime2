/*
  # Add Payment Tracking to Estimating Invoices

  1. Changes
    - Add payment link tracking fields to estimating_invoices table
    - Add payment confirmation email tracking
    - Add balance_due field to track remaining balance
    - Add deposit_applied field to track deposits from work orders

  2. New Columns
    - `payment_link` (text) - Stripe payment link URL
    - `payment_link_created_at` (timestamptz) - When payment link was created
    - `payment_email_sent_at` (timestamptz) - When payment request email was sent
    - `payment_email_recipient` (text) - Email address where payment request was sent
    - `payment_email_delivered_at` (timestamptz) - When email was delivered
    - `payment_email_opened_at` (timestamptz) - When email was opened
    - `payment_email_clicked_at` (timestamptz) - When payment link was clicked
    - `payment_email_bounced_at` (timestamptz) - When email bounced
    - `stripe_payment_intent_id` (text) - Stripe payment intent ID
    - `payment_method_type` (text) - Payment method: 'card', 'ach', 'cash', 'check'
    - `paid_at` (timestamptz) - When invoice was paid
    - `balance_due` (numeric) - Remaining balance to be paid
    - `deposit_applied` (numeric) - Deposit amount applied from work order
    - `payment_confirmation_email_sent_at` (timestamptz) - When payment confirmation was sent
*/

-- Add payment tracking fields
ALTER TABLE estimating_invoices
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS payment_link_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_recipient text,
  ADD COLUMN IF NOT EXISTS payment_email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_method_type text DEFAULT 'card' CHECK (payment_method_type IN ('card', 'ach', 'cash', 'check')),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_due numeric(10, 2),
  ADD COLUMN IF NOT EXISTS deposit_applied numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_confirmation_email_sent_at timestamptz;

-- Create index for payment link lookups
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_payment_link ON estimating_invoices(payment_link);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_stripe_payment ON estimating_invoices(stripe_payment_intent_id);

-- Update existing invoices to set balance_due equal to total_amount - amount_paid
UPDATE estimating_invoices
SET balance_due = total_amount - amount_paid
WHERE balance_due IS NULL;