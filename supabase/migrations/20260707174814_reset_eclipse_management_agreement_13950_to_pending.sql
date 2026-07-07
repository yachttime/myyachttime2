-- Reset Eclipse management agreement $13,950 payment from 'processing' to 'pending'
-- Payment failed due to connection timeout
UPDATE yacht_invoices
SET 
  payment_status = 'pending',
  stripe_payment_intent_id = NULL,
  stripe_checkout_session_id = NULL,
  paid_at = NULL
WHERE id = 'aea91723-f367-4dff-9c05-4146095fa362'
  AND payment_status = 'processing'
  AND invoice_amount = '$13950.00';