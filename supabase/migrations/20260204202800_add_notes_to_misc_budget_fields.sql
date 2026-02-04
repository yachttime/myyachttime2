/*
  # Add Notes Fields for Misc Budget Items

  1. Overview
    - Adds note fields for misc_1 and misc_2 budget items
    - Allows users to document what miscellaneous expenses represent

  2. Changes
    - Add `misc_1_notes` (text) - Description of misc_1 expenses
    - Add `misc_2_notes` (text) - Description of misc_2 expenses
    - Fields default to empty string

  3. Notes
    - Helps track and document miscellaneous budget categories
*/

-- Add notes columns for misc budget items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'misc_1_notes'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN misc_1_notes text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_budgets' AND column_name = 'misc_2_notes'
  ) THEN
    ALTER TABLE yacht_budgets ADD COLUMN misc_2_notes text DEFAULT '';
  END IF;
END $$;