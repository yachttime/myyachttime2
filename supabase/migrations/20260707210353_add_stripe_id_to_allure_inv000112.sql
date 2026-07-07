/*
  Fix INV000112: add Stripe payment method reference pm_1Tpx7P3o2gQn156dN9wxCapz
  that was omitted from the previous migration marking it paid.
*/
UPDATE estimating_invoices
SET
  final_payment_stripe_payment_intent_id = 'pm_1Tpx7P3o2gQn156dN9wxCapz',
  updated_at = now()
WHERE id = '14f17a55-430c-495d-b28d-325b994139c7'
  AND invoice_number = 'INV000112'
  AND payment_status = 'paid';
