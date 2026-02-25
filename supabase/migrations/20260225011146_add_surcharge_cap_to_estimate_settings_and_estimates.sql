/*
  # Add Surcharge Cap to Estimate Settings and Estimates

  ## Summary
  Adds a maximum cap dollar amount for the surcharge charge on estimates and invoices.
  When the calculated surcharge exceeds the cap, the cap amount is used instead.

  ## Changes

  ### Modified Tables
  - `estimate_settings`
    - `surcharge_cap` (numeric, nullable) — Maximum dollar amount the surcharge can reach.
      NULL means no cap (current behavior). Any positive value limits the surcharge.

  - `estimates`
    - `surcharge_cap` (numeric, nullable) — The cap that was active when this estimate
      was created/saved, so historical records retain their original cap setting.

  ## Notes
  - NULL cap = no limit (existing behavior preserved)
  - Cap is a dollar amount, not a percentage
  - Stored on the estimate at save time so edits to settings don't retroactively
    change existing estimates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_settings' AND column_name = 'surcharge_cap'
  ) THEN
    ALTER TABLE estimate_settings ADD COLUMN surcharge_cap numeric DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'surcharge_cap'
  ) THEN
    ALTER TABLE estimates ADD COLUMN surcharge_cap numeric DEFAULT NULL;
  END IF;
END $$;
