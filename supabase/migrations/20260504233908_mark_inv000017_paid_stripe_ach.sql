/*
  # Mark INV000017 as paid — ACH payment pi_3TMcvW3o2gQn156d10DVcPvu

  The payment was confirmed in Stripe on April 15 2026 via ACH bank transfer
  for $3,182.27. The webhook missed it because ACH payments fire
  checkout.session.async_payment_succeeded, not checkout.session.completed.
*/
UPDATE estimating_invoices
SET
  payment_status = 'paid',
  amount_paid = 3182.27,
  balance_due = 0,
  final_payment_stripe_payment_intent_id = 'pi_3TMcvW3o2gQn156d10DVcPvu',
  final_payment_paid_at = '2026-04-15 16:35:00+00',
  final_payment_method_type = 'ach',
  updated_at = now()
WHERE invoice_number = 'INV000017'
  AND payment_status != 'paid';
