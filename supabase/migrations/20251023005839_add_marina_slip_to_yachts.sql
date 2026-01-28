/*
  # Add Marina and Slip Location to Yachts

  1. Changes
    - Add `marina_name` column to yachts table (text)
    - Add `slip_location` column to yachts table (text)
    - These fields store the yacht's berth information
  
  2. Notes
    - Both columns are nullable to allow gradual data migration
    - Useful for tracking where each yacht is docked
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'marina_name'
  ) THEN
    ALTER TABLE yachts ADD COLUMN marina_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'slip_location'
  ) THEN
    ALTER TABLE yachts ADD COLUMN slip_location text;
  END IF;
END $$;