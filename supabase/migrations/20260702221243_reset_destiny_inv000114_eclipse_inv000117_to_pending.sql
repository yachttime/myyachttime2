
-- Reset DESTINY INV000114 and ECLIPSE INV000117 to pending
-- These were incorrectly marked as paid on 2026-07-02; Stripe has no record of these payments.

UPDATE estimating_invoices
SET
  payment_status = 'pending',
  payment_method_type = NULL,
  stripe_payment_intent_id = NULL
WHERE id = '56781430-9db0-417e-9300-e59b09d9e2d3'; -- INV000114 DESTINY

UPDATE estimating_invoices
SET
  payment_status = 'pending',
  payment_method_type = NULL,
  stripe_payment_intent_id = NULL
WHERE id = '83c7158d-9918-4c7c-8602-30c3c404619e'; -- INV000117 ECLIPSE
