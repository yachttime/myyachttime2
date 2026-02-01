/*
  # Create Function to Get Schedules Needing Reminders

  1. New Functions
    - `get_schedules_needing_reminders(check_date date, check_time time)`
      - Returns list of staff who should have started work but haven't punched in
      - Checks both regular schedules and schedule overrides
      - Only returns active staff members
      - Excludes approved time off requests

  2. Purpose
    - Used by the time clock reminder edge function
    - Finds staff who need to be reminded to punch in
    - Handles regular schedules and override schedules
*/

CREATE OR REPLACE FUNCTION get_schedules_needing_reminders(
  check_date date,
  check_time time
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email_address text,
  schedule_date date,
  start_time time,
  scheduled_start_datetime text
) AS $$
BEGIN
  RETURN QUERY
  WITH staff_on_duty AS (
    -- Get staff from regular schedules
    SELECT 
      ss.user_id,
      up.full_name,
      up.email_address,
      check_date as schedule_date,
      ss.start_time,
      (check_date || ' ' || ss.start_time)::text as scheduled_start_datetime
    FROM staff_schedules ss
    JOIN user_profiles up ON up.user_id = ss.user_id
    WHERE ss.is_working = true
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if their start time was at least 10 minutes ago
      AND ss.start_time <= (check_time::time - interval '10 minutes')::time
      -- Make sure it's the right day of week
      AND CASE ss.day_of_week
        WHEN 'monday' THEN EXTRACT(DOW FROM check_date) = 1
        WHEN 'tuesday' THEN EXTRACT(DOW FROM check_date) = 2
        WHEN 'wednesday' THEN EXTRACT(DOW FROM check_date) = 3
        WHEN 'thursday' THEN EXTRACT(DOW FROM check_date) = 4
        WHEN 'friday' THEN EXTRACT(DOW FROM check_date) = 5
        WHEN 'saturday' THEN EXTRACT(DOW FROM check_date) = 6
        WHEN 'sunday' THEN EXTRACT(DOW FROM check_date) = 0
        ELSE false
      END
      -- Check if they don't have an override for today
      AND NOT EXISTS (
        SELECT 1 FROM staff_schedule_overrides sso
        WHERE sso.user_id = ss.user_id
        AND sso.override_date = check_date
      )
      -- Check if they don't have approved time off
      AND NOT EXISTS (
        SELECT 1 FROM staff_time_off_requests stor
        WHERE stor.user_id = ss.user_id
        AND stor.status = 'approved'
        AND check_date BETWEEN stor.start_date AND stor.end_date
      )

    UNION

    -- Get staff from schedule overrides
    SELECT 
      sso.user_id,
      up.full_name,
      up.email_address,
      sso.override_date as schedule_date,
      sso.start_time,
      (sso.override_date || ' ' || sso.start_time)::text as scheduled_start_datetime
    FROM staff_schedule_overrides sso
    JOIN user_profiles up ON up.user_id = sso.user_id
    WHERE sso.override_date = check_date
      AND sso.is_working = true
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if their start time was at least 10 minutes ago
      AND sso.start_time <= (check_time::time - interval '10 minutes')::time
      -- Check if they don't have approved time off
      AND NOT EXISTS (
        SELECT 1 FROM staff_time_off_requests stor
        WHERE stor.user_id = sso.user_id
        AND stor.status = 'approved'
        AND check_date BETWEEN stor.start_date AND stor.end_date
      )
  )
  SELECT * FROM staff_on_duty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_schedules_needing_reminders(date, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schedules_needing_reminders(date, time) TO service_role;
