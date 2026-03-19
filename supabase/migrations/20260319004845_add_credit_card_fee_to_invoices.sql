/*
  # Add Credit Card Processing Fee to Invoices

  ## Summary
  Adds a `credit_card_fee` column to both `estimating_invoices` and `yacht_invoices` tables
  to store the 3% credit card processing fee dollar amount.

  ## Changes

  ### Modified Tables
  - `estimating_invoices`: Added `credit_card_fee` numeric(10,2) column
  - `yacht_invoices`: Added `credit_card_fee` numeric(10,2) column

  ## Notes
  - Column is nullable: NULL means no fee was applied (ACH or "both" payment methods)
  - A positive value indicates a card-only payment link was generated with a 3% fee
  - The fee is calculated at payment link generation time and stored for record-keeping
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'credit_card_fee'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN credit_card_fee numeric(10,2) DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'credit_card_fee'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN credit_card_fee numeric(10,2) DEFAULT NULL;
  END IF;
END $$;
