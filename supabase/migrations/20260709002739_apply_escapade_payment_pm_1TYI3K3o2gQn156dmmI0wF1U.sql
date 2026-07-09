-- Apply Stripe payment pm_1TYI3K3o2gQn156dmmI0wF1U ($3,182.27) to all outstanding Escapade invoices
-- Total outstanding: $2,952.04 → All invoices paid in full, credit of $230.23 remains

-- INV000100: balance $430.50 → paid in full
UPDATE estimating_invoices
SET amount_paid = total_amount,
    balance_due = 0,
    payment_status = 'paid',
    final_payment_stripe_payment_intent_id = 'pm_1TYI3K3o2gQn156dmmI0wF1U',
    final_payment_paid_at = NOW(),
    paid_at = NOW()
WHERE id = '6883f425-78f2-44e2-ba10-572c0c11f4e2';

-- INV000122: balance $100.22 → paid in full (already had $1,068.07 paid)
UPDATE estimating_invoices
SET amount_paid = total_amount,
    balance_due = 0,
    payment_status = 'paid',
    final_payment_stripe_payment_intent_id = 'pm_1TYI3K3o2gQn156dmmI0wF1U',
    final_payment_paid_at = NOW()
WHERE id = '5407c611-6121-4269-b6c3-1f85a255799f';

-- INV000129: balance $989.78 → paid in full
UPDATE estimating_invoices
SET amount_paid = total_amount,
    balance_due = 0,
    payment_status = 'paid',
    final_payment_stripe_payment_intent_id = 'pm_1TYI3K3o2gQn156dmmI0wF1U',
    final_payment_paid_at = NOW(),
    paid_at = NOW()
WHERE id = '1d540eb8-dadc-4c90-938d-fc14a7e49ae7';

-- INV000147: balance $1,431.54 → paid in full
UPDATE estimating_invoices
SET amount_paid = total_amount,
    balance_due = 0,
    payment_status = 'paid',
    final_payment_stripe_payment_intent_id = 'pm_1TYI3K3o2gQn156dmmI0wF1U',
    final_payment_paid_at = NOW(),
    paid_at = NOW()
WHERE id = '6db1fca1-96c7-4439-8697-313cbf85ad5f';

-- Insert payment records into estimating_payments for audit trail
INSERT INTO estimating_payments (company_id, payment_type, invoice_id, yacht_id, amount, payment_method, payment_method_type, stripe_payment_intent_id, notes, payment_date, recorded_by)
VALUES
  ('519b4394-d35c-46d7-997c-db7e46178ef5', 'invoice_payment', '6883f425-78f2-44e2-ba10-572c0c11f4e2', 'c339f147-3ae5-4fdc-b5f3-1dc2a2b6b786', 430.50, 'stripe', 'card', 'pm_1TYI3K3o2gQn156dmmI0wF1U', 'Bulk payment applied. Total payment: $3,182.27 across 4 invoices. Credit remaining: $230.23', NOW(), '610f94b4-646f-4f5b-b64a-a47723f6e85e'),
  ('519b4394-d35c-46d7-997c-db7e46178ef5', 'invoice_payment', '5407c611-6121-4269-b6c3-1f85a255799f', 'c339f147-3ae5-4fdc-b5f3-1dc2a2b6b786', 100.22, 'stripe', 'card', 'pm_1TYI3K3o2gQn156dmmI0wF1U', 'Final balance payment. Total payment: $3,182.27 across 4 invoices. Credit remaining: $230.23', NOW(), '610f94b4-646f-4f5b-b64a-a47723f6e85e'),
  ('519b4394-d35c-46d7-997c-db7e46178ef5', 'invoice_payment', '1d540eb8-dadc-4c90-938d-fc14a7e49ae7', 'c339f147-3ae5-4fdc-b5f3-1dc2a2b6b786', 989.78, 'stripe', 'card', 'pm_1TYI3K3o2gQn156dmmI0wF1U', 'Bulk payment applied. Total payment: $3,182.27 across 4 invoices. Credit remaining: $230.23', NOW(), '610f94b4-646f-4f5b-b64a-a47723f6e85e'),
  ('519b4394-d35c-46d7-997c-db7e46178ef5', 'invoice_payment', '6db1fca1-96c7-4439-8697-313cbf85ad5f', 'c339f147-3ae5-4fdc-b5f3-1dc2a2b6b786', 1431.54, 'stripe', 'card', 'pm_1TYI3K3o2gQn156dmmI0wF1U', 'Bulk payment applied. Total payment: $3,182.27 across 4 invoices. Credit remaining: $230.23', NOW(), '610f94b4-646f-4f5b-b64a-a47723f6e85e');

-- CREDIT NOTE: Payment of $3,182.27 exceeded total outstanding of $2,952.04.
-- Escapade has a CREDIT of $230.23 from payment pm_1TYI3K3o2gQn156dmmI0wF1U.