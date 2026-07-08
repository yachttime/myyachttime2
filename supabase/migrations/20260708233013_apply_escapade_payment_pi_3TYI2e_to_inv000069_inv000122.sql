-- Payment pi_3TYI2e3o2gQn156d00nNJaSR ($3,182.27) split across two invoices:
-- INV000069: $2,114.20 paid in full
-- INV000122: $1,068.07 partial payment (balance remaining $100.22)

UPDATE estimating_invoices
SET payment_status = 'paid',
    final_payment_stripe_payment_intent_id = 'pi_3TYI2e3o2gQn156d00nNJaSR',
    final_payment_paid_at = '2026-05-17T20:17:00Z',
    final_payment_method_type = 'card'
WHERE invoice_number = 'INV000069';

UPDATE estimating_invoices
SET final_payment_stripe_payment_intent_id = 'pi_3TYI2e3o2gQn156d00nNJaSR',
    final_payment_paid_at = '2026-05-17T20:17:00Z',
    final_payment_method_type = 'card',
    amount_paid = 1068.07
WHERE invoice_number = 'INV000122';
