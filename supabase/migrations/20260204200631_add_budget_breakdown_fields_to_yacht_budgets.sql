/*
  # Add Budget Breakdown Fields to Yacht Budgets

  1. Overview
    - Adds detailed budget breakdown fields to yacht_budgets table
    - Enables tracking of specific budget categories instead of single amount
    - Maintains backward compatibility with existing budget_amount field

  2. Changes to yacht_budgets table
    - Add `management_fees` (numeric) - Management service fees
    - Add `trip_inspection_fees` (numeric) - Trip inspection costs
    - Add `spring_startup_cost` (numeric) - Spring startup and commissioning costs
    - Add `oil_change_200hr` (numeric) - 200-hour oil change maintenance
    - Add `oil_change_600hr` (numeric) - 600-hour oil change maintenance
    - Add `preventive_maintenance` (numeric) - General preventive maintenance
    - Add `winter_repairs_upgrades` (numeric) - Winter repair and upgrade costs
    - Add `winterizations` (numeric) - Winterization costs
    - Add `misc_1` (numeric) - Miscellaneous category 1
    - Add `misc_2` (numeric) - Miscellaneous category 2
    - All new fields default to 0 and are NOT NULL

  3. Notes
    - Existing budget_amount field is retained for backward compatibility
    - Budget amount can be calculated as sum of all breakdown fields
    - All breakdown fields are numeric(10,2) to match existing budget_amount
*/

-- Add budget breakdown columns to yacht_budgets table
DO $$
BEGIN
  -- Management fees
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'management_fees'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN management_fees numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Trip inspection fees
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'trip_inspection_fees'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN trip_inspection_fees numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Spring startup cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'spring_startup_cost'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN spring_startup_cost numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- 200 hour oil changes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'oil_change_200hr'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN oil_change_200hr numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- 600 hour oil changes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'oil_change_600hr'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN oil_change_600hr numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Preventive maintenance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'preventive_maintenance'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN preventive_maintenance numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Winter repairs and upgrades
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'winter_repairs_upgrades'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN winter_repairs_upgrades numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Winterizations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'winterizations'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN winterizations numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Miscellaneous 1
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'misc_1'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN misc_1 numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Miscellaneous 2
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'misc_2'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN misc_2 numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;