
-- Apply $93.40 credit from INV000066 (overpaid) to INV000118 on Intrigue

-- Mark INV000066 credit as fully applied (balance_due 0)
UPDATE estimating_invoices
SET balance_due = 0.00,
    notes = COALESCE(notes || E'\n', '') || 'Credit of $93.40 applied to INV000118 on 2026-06-27.',
    updated_at = now()
WHERE id = '8db227c2-bd45-47b8-bbe8-7e1458b50049';

-- Apply $93.40 credit to INV000118 as deposit_applied
UPDATE estimating_invoices
SET deposit_applied = 93.40,
    balance_due = 1168.29 - 93.40,
    notes = COALESCE(notes || E'\n', '') || 'Credit of $93.40 applied from overpayment on INV000066.',
    updated_at = now()
WHERE id = '6704b636-8b76-45e3-9aae-5c9824ed5df4';
