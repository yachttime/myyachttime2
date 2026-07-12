
-- Mark OBESSION INV000094 ($20,000) as paid via card
-- Customer paid 3 times, 2 payments were credited back
UPDATE estimating_invoices
SET payment_status = 'paid',
    payment_method_type = 'card'
WHERE id = 'a6c3cf08-33a0-4570-84e3-d342f5b2e511';
