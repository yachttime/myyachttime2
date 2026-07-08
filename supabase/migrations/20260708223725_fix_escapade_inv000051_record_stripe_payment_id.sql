-- Record the Stripe payment intent ID for Escapade INV000051 ($10,777.57)
-- Payment was via ACH, paid 2026-04-21
UPDATE estimating_invoices
SET
  final_payment_stripe_payment_intent_id = 'pi_3TMcyw3o2gQn156d1hMZ03WN',
  final_payment_paid_at = '2026-04-21T21:12:53.447Z',
  final_payment_method_type = 'ach'
WHERE invoice_number = 'INV000051'
  AND id = '899fbc9c-1ae2-4ab4-92b6-c68c2a02342c';