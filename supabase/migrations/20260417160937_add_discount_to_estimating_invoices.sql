/*
  # Add Discount Fields to Estimating Invoices

  ## Summary
  Adds discount support to the estimating_invoices table so that discounts
  applied on the originating estimate/work order are preserved when converting
  a work order to an invoice.

  ## Changes
  1. New Columns on `estimating_invoices`
     - `discount_percentage` (numeric, default 0) — discount % from the estimate
     - `discount_amount` (numeric, default 0) — calculated discount dollar amount

  ## Notes
  - Both fields default to 0 so existing invoices are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN discount_percentage numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN discount_amount numeric DEFAULT 0;
  END IF;
END $$;
