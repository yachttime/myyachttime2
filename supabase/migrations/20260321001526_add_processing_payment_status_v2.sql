/*
  # Add 'processing' payment status

  1. Changes
    - Adds 'processing' as a valid value for deposit_payment_status on repair_requests
    - Adds 'processing' as a valid value for payment_status on yacht_invoices
    - Adds 'processing' as a valid value for payment_status on estimating_invoices
    - 'processing' means the customer has submitted payment in Stripe but it has not yet
      settled (common with ACH/bank transfers which take 1-5 business days)

  2. Notes
    - Does NOT affect any existing data
    - 'processing' sits between 'pending'/'unpaid' and 'paid' in the payment lifecycle
    - estimating_invoices uses 'unpaid' (not 'pending') as its default status
*/

ALTER TABLE repair_requests
  DROP CONSTRAINT IF EXISTS repair_requests_deposit_payment_status_check;

ALTER TABLE repair_requests
  ADD CONSTRAINT repair_requests_deposit_payment_status_check
  CHECK (deposit_payment_status IN ('pending', 'processing', 'paid', 'refunded', 'failed'));

ALTER TABLE yacht_invoices
  DROP CONSTRAINT IF EXISTS yacht_invoices_payment_status_check;

ALTER TABLE yacht_invoices
  ADD CONSTRAINT yacht_invoices_payment_status_check
  CHECK (payment_status IN ('pending', 'processing', 'paid', 'partial', 'refunded', 'failed'));

ALTER TABLE estimating_invoices
  DROP CONSTRAINT IF EXISTS estimating_invoices_payment_status_check;

ALTER TABLE estimating_invoices
  ADD CONSTRAINT estimating_invoices_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'processing', 'paid', 'partial', 'refunded', 'failed'));
