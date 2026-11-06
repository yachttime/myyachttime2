/*
# Reset INV000053 from stuck "processing" to unpaid

1. Modified Table
- `estimating_invoices` row INV000053 (id 5f8b242a-275e-4106-944e-8e58d0d8a482)
- `payment_status` changed from `processing` to `unpaid`
- `stripe_payment_intent_id` cleared (abandoned payment attempt that never completed)

2. Why
- A payment attempt was started but never completed, leaving the invoice in
  "processing". The payment link generator refuses to create a new link while an
  invoice is processing, so the link could not be regenerated.

3. Security
- No policy or grant changes.

4. Notes
- Guarded so it only applies if the invoice has no recorded payment (amount_paid = 0, no paid_at).
- Idempotent: re-running after the reset changes nothing.
*/

UPDATE estimating_invoices
SET payment_status = 'unpaid',
    stripe_payment_intent_id = NULL
WHERE id = '5f8b242a-275e-4106-944e-8e58d0d8a482'
  AND invoice_number = 'INV000053'
  AND COALESCE(amount_paid, 0) = 0
  AND paid_at IS NULL;
