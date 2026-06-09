-- Fix INV000062: mark as paid based on confirmed Stripe payment from Apr 7, 2026
-- The Stripe payment pi_3THR... for $14,493.01 was confirmed paid before the invoice existed
UPDATE estimating_invoices
SET
  payment_status = 'paid',
  amount_paid = 14493.01,
  balance_due = 0.00,
  final_payment_paid_at = '2026-04-07T00:00:00+00:00',
  final_payment_method_type = 'card',
  updated_at = now()
WHERE id = 'afecd729-fe49-4bbb-9cce-1ebb18a38019'
  AND payment_status = 'unpaid';
