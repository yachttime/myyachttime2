/*
  # Make booking_id Nullable in trip_inspections

  1. Changes
    - Alter `booking_id` column in trip_inspections table to be nullable
    
  2. Reason
    - Trip inspections can be performed without being tied to a specific booking
    - Staff may perform routine inspections outside of the booking context
    - This allows for more flexible inspection workflows
*/

DO $$
BEGIN
  -- Make booking_id nullable
  ALTER TABLE trip_inspections ALTER COLUMN booking_id DROP NOT NULL;
END $$;