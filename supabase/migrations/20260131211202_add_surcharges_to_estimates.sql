/*
  # Add Surcharges to Estimates

  1. Changes
    - Add shop_supplies_rate and shop_supplies_amount to estimates
    - Add park_fees_rate and park_fees_amount to estimates
    - Add surcharge_rate and surcharge_amount to estimates
    - Rename tax_rate to sales_tax_rate and tax_amount to sales_tax_amount for clarity

  2. Notes
    - All rates stored as decimals (e.g., 0.08 for 8%)
    - All amounts stored as numeric for precise calculations
*/

-- Add new surcharge columns to estimates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'shop_supplies_rate'
  ) THEN
    ALTER TABLE estimates ADD COLUMN shop_supplies_rate numeric(5,4) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'shop_supplies_amount'
  ) THEN
    ALTER TABLE estimates ADD COLUMN shop_supplies_amount numeric(12,2) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'park_fees_rate'
  ) THEN
    ALTER TABLE estimates ADD COLUMN park_fees_rate numeric(5,4) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'park_fees_amount'
  ) THEN
    ALTER TABLE estimates ADD COLUMN park_fees_amount numeric(12,2) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'surcharge_rate'
  ) THEN
    ALTER TABLE estimates ADD COLUMN surcharge_rate numeric(5,4) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'surcharge_amount'
  ) THEN
    ALTER TABLE estimates ADD COLUMN surcharge_amount numeric(12,2) DEFAULT 0 NOT NULL;
  END IF;

  -- Rename tax_rate to sales_tax_rate for clarity (if not already renamed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'tax_rate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'sales_tax_rate'
  ) THEN
    ALTER TABLE estimates RENAME COLUMN tax_rate TO sales_tax_rate;
  END IF;

  -- Rename tax_amount to sales_tax_amount for clarity (if not already renamed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'tax_amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimates' AND column_name = 'sales_tax_amount'
  ) THEN
    ALTER TABLE estimates RENAME COLUMN tax_amount TO sales_tax_amount;
  END IF;
END $$;
