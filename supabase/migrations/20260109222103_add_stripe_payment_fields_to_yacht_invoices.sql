/*
  # Add Stripe Payment Tracking to Yacht Invoices

  1. Overview
    - Adds Stripe payment integration fields to yacht_invoices table
    - Enables online payment processing for invoices
    - Tracks payment status and transaction details

  2. New Columns
    - `stripe_payment_intent_id` (text) - Stripe PaymentIntent ID for the invoice
    - `stripe_checkout_session_id` (text) - Stripe Checkout Session ID
    - `payment_status` (text) - Current payment status (pending, paid, failed, refunded)
    - `payment_method` (text) - Payment method used (card, bank_transfer, etc.)
    - `paid_at` (timestamptz) - Timestamp when payment was completed
    - `stripe_customer_id` (text) - Stripe Customer ID for the payer
    - `payment_link_url` (text) - Stripe payment link URL for easy sharing

  3. Changes
    - Defaults payment_status to 'pending' for new invoices
    - Adds index on stripe_payment_intent_id for webhook lookups
    - Adds index on payment_status for filtering paid/unpaid invoices

  4. Notes
    - Existing invoices will have NULL payment_status (legacy invoices)
    - New invoices will default to 'pending' status
    - Payment webhooks will update these fields when payments complete
*/

-- Add Stripe payment tracking columns
DO $$
BEGIN
  -- Add stripe_payment_intent_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN stripe_payment_intent_id text;
  END IF;

  -- Add stripe_checkout_session_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'stripe_checkout_session_id'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN stripe_checkout_session_id text;
  END IF;

  -- Add payment_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_status text DEFAULT 'pending';
  END IF;

  -- Add payment_method if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_method text;
  END IF;

  -- Add paid_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN paid_at timestamptz;
  END IF;

  -- Add stripe_customer_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN stripe_customer_id text;
  END IF;

  -- Add payment_link_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_link_url'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_link_url text;
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_stripe_payment_intent 
  ON yacht_invoices(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_yacht_invoices_payment_status 
  ON yacht_invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_yacht_invoices_stripe_checkout_session 
  ON yacht_invoices(stripe_checkout_session_id);
