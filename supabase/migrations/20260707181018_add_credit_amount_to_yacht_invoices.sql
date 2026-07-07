-- Add credit_amount column to yacht_invoices for tracking overpayments
ALTER TABLE yacht_invoices ADD COLUMN IF NOT EXISTS credit_amount numeric(10,2) DEFAULT NULL;

-- Set credit for Eclipse deck repairs invoice (two payments of $7,502.41 = $15,004.82 against $14,502.41 invoice)
UPDATE yacht_invoices
SET credit_amount = 502.41
WHERE id = 'b3a424ed-d063-42c9-b4a4-cc14e086412e';