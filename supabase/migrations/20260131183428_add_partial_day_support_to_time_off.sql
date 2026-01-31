/*
  # Add Partial Day Support to Staff Time Off Requests

  1. Changes
    - Add `is_partial_day` (boolean) to indicate partial day requests
    - Add `hours_taken` (decimal) to store hours for partial days
    - Add constraint to ensure hours_taken is between 0 and 24
    - Default is_partial_day to false for existing records
  
  2. Notes
    - For full-day requests: is_partial_day = false, hours_taken = null
    - For partial-day requests: is_partial_day = true, hours_taken = actual hours (e.g., 4 for half day)
    - Assumes standard 8-hour workday for fractional calculations
    - If start_date = end_date and is_partial_day = true, use hours_taken
    - If start_date != end_date, calculate full days regardless of is_partial_day
*/

-- Add new columns to staff_time_off_requests
DO $$
BEGIN
  -- Add is_partial_day column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_time_off_requests' AND column_name = 'is_partial_day'
  ) THEN
    ALTER TABLE staff_time_off_requests 
    ADD COLUMN is_partial_day boolean DEFAULT false NOT NULL;
  END IF;

  -- Add hours_taken column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_time_off_requests' AND column_name = 'hours_taken'
  ) THEN
    ALTER TABLE staff_time_off_requests 
    ADD COLUMN hours_taken decimal(4,2);
  END IF;
END $$;

-- Add constraint to ensure hours_taken is valid (0.5 to 24 hours)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_hours_taken'
  ) THEN
    ALTER TABLE staff_time_off_requests
    ADD CONSTRAINT valid_hours_taken CHECK (hours_taken IS NULL OR (hours_taken >= 0.5 AND hours_taken <= 24));
  END IF;
END $$;

-- Add constraint: if is_partial_day is true, hours_taken must be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'partial_day_requires_hours'
  ) THEN
    ALTER TABLE staff_time_off_requests
    ADD CONSTRAINT partial_day_requires_hours CHECK (
      (is_partial_day = false) OR 
      (is_partial_day = true AND hours_taken IS NOT NULL)
    );
  END IF;
END $$;