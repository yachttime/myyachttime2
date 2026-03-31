/*
  # Add Discount Fields to Estimates

  ## Summary
  Adds discount support to the estimates table so users can apply a percentage discount
  to an estimate prior to tax calculations.

  ## New Columns
  - `estimates.discount_percentage` (numeric, nullable) - The discount percentage entered by the user (e.g. 10 = 10%)
  - `estimates.discount_amount` (numeric, nullable) - The calculated dollar amount of the discount

  ## Notes
  - Discount is applied to the subtotal before sales tax, shop supplies, park fees, and surcharge are calculated
  - Existing estimates default to NULL (no discount)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE estimates ADD COLUMN discount_percentage numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE estimates ADD COLUMN discount_amount numeric DEFAULT NULL;
  END IF;
END $$;
