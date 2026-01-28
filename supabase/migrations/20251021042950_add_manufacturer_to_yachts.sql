/*
  # Add Manufacturer Column to Yachts Table

  1. Changes
    - Add `manufacturer` column to `yachts` table
    - Stores the yacht manufacturer/builder name
  
  2. Notes
    - Column is optional (nullable) to support existing records
    - Can store manufacturer names like "Sunseeker", "Azimut", "Princess", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE yachts ADD COLUMN manufacturer text;
  END IF;
END $$;