/*
  # Add Time Tracking to Schedule Overrides

  1. New Columns
    - `start_time` (time) - Start time for partial day work
    - `end_time` (time) - End time for partial day work
    - Both nullable to support full day off/work entries

  2. Usage
    - If both times are NULL, it's a full day status (working, day off, sick)
    - If times are set, it indicates partial day work (e.g., working 8am-12pm)
    - This allows tracking half-days and custom work hours

  3. Security
    - No RLS changes needed
    - Existing policies continue to work
*/

-- Add time fields to staff_schedule_overrides
ALTER TABLE staff_schedule_overrides
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- Add a check constraint to ensure end_time is after start_time when both are set
ALTER TABLE staff_schedule_overrides
  ADD CONSTRAINT staff_schedule_overrides_time_check
  CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  );
