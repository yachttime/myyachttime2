-- Add credit_amount column to estimating_invoices for tracking overpayments
ALTER TABLE estimating_invoices ADD COLUMN IF NOT EXISTS credit_amount numeric DEFAULT 0;