/*
  # Add Time Tracking to Time Off Requests

  1. New Columns
    - `start_time` (time) - Start time for partial day requests
    - `end_time` (time) - End time for partial day requests
    - Both nullable to support full day off requests

  2. Usage
    - If both times are NULL, it's a full day off request
    - If times are set, it indicates partial day request (e.g., working 8am-12pm, off in afternoon)
    - This allows tracking half-days and custom time off periods

  3. Security
    - No RLS changes needed
    - Existing policies continue to work
*/

-- Add time fields to staff_time_off_requests
ALTER TABLE staff_time_off_requests
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- Add a check constraint to ensure end_time is after start_time when both are set
ALTER TABLE staff_time_off_requests
  ADD CONSTRAINT staff_time_off_requests_time_check
  CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  );
