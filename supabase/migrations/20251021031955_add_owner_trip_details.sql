/*
  # Add Owner Trip Details

  1. Changes
    - Add `owner_name` column to yacht_bookings table (text)
    - Add `owner_contact` column to yacht_bookings table (text)
    - Add `departure_time` column to yacht_bookings table (time without timezone)
    - Add `arrival_time` column to yacht_bookings table (time without timezone)
  
  2. Notes
    - All new columns are nullable for backward compatibility
    - departure_time represents the time of day for departure
    - arrival_time represents the time of day for return/arrival
    - owner_name and owner_contact allow for non-user booking entries (owner trips)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_bookings' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE yacht_bookings ADD COLUMN owner_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_bookings' AND column_name = 'owner_contact'
  ) THEN
    ALTER TABLE yacht_bookings ADD COLUMN owner_contact text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_bookings' AND column_name = 'departure_time'
  ) THEN
    ALTER TABLE yacht_bookings ADD COLUMN departure_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_bookings' AND column_name = 'arrival_time'
  ) THEN
    ALTER TABLE yacht_bookings ADD COLUMN arrival_time time;
  END IF;
END $$;