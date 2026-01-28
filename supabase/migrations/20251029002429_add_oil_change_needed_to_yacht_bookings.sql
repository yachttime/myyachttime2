/*
  # Add oil change tracking to yacht bookings

  1. Changes
    - Add `oil_change_needed` boolean column to `yacht_bookings` table
    - Default value is `false` (normal state - red arrival)
    - When set to `true`, indicates oil change is needed (yellow state)
  
  2. Notes
    - This field is only relevant for arrival events
    - Allows marina staff to flag yachts that need oil changes upon arrival
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_bookings' AND column_name = 'oil_change_needed'
  ) THEN
    ALTER TABLE yacht_bookings ADD COLUMN oil_change_needed boolean DEFAULT false;
  END IF;
END $$;