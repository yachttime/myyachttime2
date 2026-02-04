/*
  # Add Water Filters to Yacht Budget Breakdown

  1. Overview
    - Adds water_filters field to yacht_budgets table
    - Enables tracking of water filter replacement costs in budget

  2. Changes
    - Add `water_filters` (numeric) - Water filter replacement and maintenance costs
    - Field defaults to 0 and is NOT NULL

  3. Notes
    - Consistent with other budget breakdown fields
    - Uses numeric(10,2) to match existing budget fields
*/

-- Add water_filters column to yacht_budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'water_filters'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN water_filters numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;