/*
  # Add Check Payment Support to Estimating System

  ## Summary
  Extends the estimating payment system to support recording check payments manually,
  alongside the existing Stripe card/ACH flows.

  ## Changes

  ### estimating_invoices table
  - Add `check_payment_recorded_at` (timestamptz) — when a check was manually recorded
  - Add `check_payment_amount` (numeric) — amount of the check recorded
  - Add `check_number` (text) — the check number for quick reference on the invoice

  ### work_orders table
  - Add `deposit_check_number` (text) — check number when deposit paid by check
  - Add `deposit_check_recorded_at` (timestamptz) — when deposit check was recorded

  ### estimating_payments RLS
  - Allow staff, mechanic, and manager roles to INSERT and SELECT payments
    so they can record check payments manually
*/

-- Add check tracking fields to estimating_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'check_payment_recorded_at'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN check_payment_recorded_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'check_payment_amount'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN check_payment_amount numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'check_number'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN check_number text;
  END IF;
END $$;

-- Add check tracking fields to work_orders for deposits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'deposit_check_number'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN deposit_check_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'deposit_check_recorded_at'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN deposit_check_recorded_at timestamptz;
  END IF;
END $$;

-- Expand estimating_payments RLS to allow staff/manager/mechanic to insert and view
DROP POLICY IF EXISTS "Staff can insert payments in their company" ON estimating_payments;
CREATE POLICY "Staff can insert payments in their company"
  ON estimating_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'manager', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimating_payments.company_id
    )
  );

DROP POLICY IF EXISTS "Staff can view payments in their company" ON estimating_payments;
CREATE POLICY "Staff can view payments in their company"
  ON estimating_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'manager', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimating_payments.company_id
    )
  );
