/*
  # Add Deposit Support to Repair Requests

  ## Overview
  This migration adds deposit collection functionality to repair requests, allowing staff to request deposits before starting work on approved repairs.

  ## Changes Made

  ### 1. New Columns Added to `repair_requests` table
    - `deposit_amount` (numeric) - The deposit amount requested for the repair
    - `deposit_requested_at` (timestamptz) - When the deposit was requested
    - `deposit_requested_by` (uuid) - User who requested the deposit (FK to user_profiles)
    - `deposit_payment_status` (text) - Payment status: 'pending', 'paid', 'failed'
    - `deposit_stripe_checkout_session_id` (text) - Stripe checkout session ID
    - `deposit_payment_link_url` (text) - URL to the deposit payment link
    - `deposit_paid_at` (timestamptz) - When the deposit was paid
    - `deposit_stripe_payment_intent_id` (text) - Stripe payment intent ID after successful payment
    - `deposit_email_sent_at` (timestamptz) - When the deposit request email was sent
    - `deposit_resend_email_id` (text) - Resend email ID for tracking
    - `deposit_email_recipient` (text) - Email address where deposit request was sent
    - `deposit_email_opened_at` (timestamptz) - When the deposit email was opened
    - `deposit_email_clicked_at` (timestamptz) - When the payment link was clicked

  ## Notes
  - Deposits are optional and can be requested after a repair is approved
  - Similar to invoice workflow, this integrates with Stripe for payment processing
  - Email tracking uses Resend webhooks for engagement analytics
*/

-- Add deposit-related columns to repair_requests table
ALTER TABLE repair_requests 
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_requested_by uuid REFERENCES user_profiles(user_id),
  ADD COLUMN IF NOT EXISTS deposit_payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deposit_stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS deposit_payment_link_url text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_resend_email_id text,
  ADD COLUMN IF NOT EXISTS deposit_email_recipient text,
  ADD COLUMN IF NOT EXISTS deposit_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_email_clicked_at timestamptz;

-- Add constraint for valid payment status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repair_requests_deposit_payment_status_check'
  ) THEN
    ALTER TABLE repair_requests 
      ADD CONSTRAINT repair_requests_deposit_payment_status_check 
      CHECK (deposit_payment_status IN ('pending', 'paid', 'failed'));
  END IF;
END $$;
