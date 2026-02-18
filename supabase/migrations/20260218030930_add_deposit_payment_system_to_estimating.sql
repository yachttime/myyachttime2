/*
  # Add Deposit and Payment System to Estimating Workflow

  ## Overview
  This migration adds comprehensive deposit and payment tracking to the estimating system,
  matching the functionality from the repair request system and adding QuickBooks integration.

  ## Changes Made

  ### 1. Add Deposit Fields to `estimates` table
    - `deposit_required` (boolean) - Whether a deposit is required to start work
    - `deposit_percentage` (numeric) - Percentage of total for deposit (optional)
    - `deposit_amount` (numeric) - Fixed deposit amount (optional)

  ### 2. Add Deposit/Payment Fields to `work_orders` table
    - `deposit_required` (boolean) - Whether deposit is required
    - `deposit_amount` (numeric) - Calculated or fixed deposit amount
    - `deposit_requested_at` (timestamptz) - When deposit was requested
    - `deposit_requested_by` (uuid) - User who requested deposit
    - `deposit_payment_status` (text) - 'pending', 'paid', 'failed', 'not_required'
    - `deposit_stripe_checkout_session_id` (text) - Stripe session ID
    - `deposit_payment_link_url` (text) - Payment link URL
    - `deposit_paid_at` (timestamptz) - When deposit was paid
    - `deposit_stripe_payment_intent_id` (text) - Stripe payment intent ID
    - Email tracking fields for deposit requests
    - QuickBooks sync fields

  ### 3. Add Payment Fields to `estimating_invoices` table
    - `deposit_applied` (numeric) - Deposit amount applied to invoice
    - `balance_due` (numeric) - Total amount minus deposit
    - `amount_paid` (numeric) - Amount paid towards invoice
    - Final payment tracking fields
    - QuickBooks invoice sync fields

  ### 4. Create `estimating_payments` table
    - Tracks all payments (deposits and invoice payments)
    - Links to work orders and invoices
    - Stores Stripe and QuickBooks references
    - Includes accounting code mapping

  ## Security
  - RLS policies for master role access to payments
  - Proper foreign key constraints
  - Payment status validation
*/

-- Add deposit fields to estimates table
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS deposit_percentage numeric(5, 2),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10, 2);

-- Add comprehensive deposit and payment fields to work_orders table
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS deposit_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_requested_by uuid REFERENCES user_profiles(user_id),
  ADD COLUMN IF NOT EXISTS deposit_payment_status text DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS deposit_stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS deposit_payment_link_url text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_resend_email_id text,
  ADD COLUMN IF NOT EXISTS deposit_email_recipient text,
  ADD COLUMN IF NOT EXISTS deposit_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_email_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_payment_method_type text,
  ADD COLUMN IF NOT EXISTS deposit_confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_quickbooks_payment_id text,
  ADD COLUMN IF NOT EXISTS deposit_quickbooks_synced_at timestamptz;

-- Add payment constraint for work orders deposit status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_deposit_payment_status_check'
  ) THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_deposit_payment_status_check
      CHECK (deposit_payment_status IN ('pending', 'paid', 'failed', 'not_required'));
  END IF;
END $$;

-- Add payment method type constraint for work orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_deposit_payment_method_type_check'
  ) THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_deposit_payment_method_type_check
      CHECK (deposit_payment_method_type IN ('card', 'ach'));
  END IF;
END $$;

-- Add payment fields to estimating_invoices table
ALTER TABLE estimating_invoices
  ADD COLUMN IF NOT EXISTS deposit_applied numeric(10, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS balance_due numeric(10, 2),
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS final_payment_stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS final_payment_link_url text,
  ADD COLUMN IF NOT EXISTS final_payment_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS final_payment_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_resend_email_id text,
  ADD COLUMN IF NOT EXISTS final_payment_email_recipient text,
  ADD COLUMN IF NOT EXISTS final_payment_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_email_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_method_type text,
  ADD COLUMN IF NOT EXISTS final_payment_confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_id text,
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_synced_at timestamptz;

-- Create estimating_payments table to track all payments
CREATE TABLE IF NOT EXISTS estimating_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('deposit', 'invoice_payment', 'final_payment')),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES estimating_invoices(id) ON DELETE CASCADE,
  estimate_id uuid REFERENCES estimates(id),
  yacht_id uuid REFERENCES yachts(id),
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  is_retail_customer boolean DEFAULT false NOT NULL,

  amount numeric(10, 2) NOT NULL,
  payment_date timestamptz DEFAULT now() NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('stripe', 'cash', 'check', 'wire', 'other')),
  payment_method_type text CHECK (payment_method_type IN ('card', 'ach')),

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,

  quickbooks_payment_id text,
  quickbooks_synced_at timestamptz,
  quickbooks_sync_error text,
  accounting_code_id uuid REFERENCES accounting_codes(id),

  notes text,
  reference_number text,
  recorded_by uuid REFERENCES user_profiles(user_id) NOT NULL,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for estimating_payments
CREATE INDEX IF NOT EXISTS idx_estimating_payments_company ON estimating_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_estimating_payments_work_order ON estimating_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_estimating_payments_invoice ON estimating_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_estimating_payments_estimate ON estimating_payments(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimating_payments_yacht ON estimating_payments(yacht_id);
CREATE INDEX IF NOT EXISTS idx_estimating_payments_date ON estimating_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_estimating_payments_quickbooks ON estimating_payments(quickbooks_payment_id);

-- Enable RLS on estimating_payments
ALTER TABLE estimating_payments ENABLE ROW LEVEL SECURITY;

-- Master users can view all payments in their company
CREATE POLICY "Master users can view payments in their company"
  ON estimating_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimating_payments.company_id
    )
  );

-- Master users can insert payments in their company
CREATE POLICY "Master users can insert payments in their company"
  ON estimating_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimating_payments.company_id
    )
  );

-- Master users can update payments in their company
CREATE POLICY "Master users can update payments in their company"
  ON estimating_payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimating_payments.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimating_payments.company_id
    )
  );

-- Master users can delete payments in their company
CREATE POLICY "Master users can delete payments in their company"
  ON estimating_payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimating_payments.company_id
    )
  );

-- Function to calculate balance due on invoice
CREATE OR REPLACE FUNCTION calculate_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_due := NEW.total_amount - NEW.deposit_applied - NEW.amount_paid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate balance due
DROP TRIGGER IF EXISTS trigger_calculate_invoice_balance ON estimating_invoices;
CREATE TRIGGER trigger_calculate_invoice_balance
  BEFORE INSERT OR UPDATE OF total_amount, deposit_applied, amount_paid
  ON estimating_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_balance();

-- Enable realtime for estimating_payments
ALTER PUBLICATION supabase_realtime ADD TABLE estimating_payments;