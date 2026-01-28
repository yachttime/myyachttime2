/*
  # Add trip number field to user profiles

  1. Changes
    - Add `trip_number` column to `user_profiles` table
      - Type: text (can include letters/numbers like "T1", "T2", etc.)
      - Optional field for owners to track their trip sequence
      - Not required, defaults to NULL
  
  2. Notes
    - This field helps staff track which trip number an owner is on
    - Useful for documentation and management purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'trip_number'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN trip_number text;
  END IF;
END $$;
