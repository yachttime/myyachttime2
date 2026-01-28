/*
  # Add Yacht Specifications

  1. Changes
    - Add `hull_number` column to yachts table (text, unique)
    - Add `size` column to yachts table (text)
    - Add `port_engine` column to yachts table (text)
    - Add `starboard_engine` column to yachts table (text)
    - Add `port_generator` column to yachts table (text)
    - Add `starboard_generator` column to yachts table (text)
  
  2. Notes
    - All new columns are nullable to allow gradual data migration
    - `hull_number` has a unique constraint as it's a vessel identifier
    - Engine and generator fields store text descriptions of the equipment
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'hull_number'
  ) THEN
    ALTER TABLE yachts ADD COLUMN hull_number text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'size'
  ) THEN
    ALTER TABLE yachts ADD COLUMN size text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'port_engine'
  ) THEN
    ALTER TABLE yachts ADD COLUMN port_engine text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'starboard_engine'
  ) THEN
    ALTER TABLE yachts ADD COLUMN starboard_engine text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'port_generator'
  ) THEN
    ALTER TABLE yachts ADD COLUMN port_generator text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'starboard_generator'
  ) THEN
    ALTER TABLE yachts ADD COLUMN starboard_generator text;
  END IF;
END $$;