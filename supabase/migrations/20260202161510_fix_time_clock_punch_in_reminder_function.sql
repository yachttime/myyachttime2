/*
  # Fix Time Clock Punch-In Reminder Function

  1. Changes
    - Fix column reference from `is_working` to `is_working_day`
    - Fix `day_of_week` handling - it's an integer (0-6) not text
    - Fix user profile column references to use actual column names
    - Use `(first_name || ' ' || last_name)` instead of non-existent `full_name`
    - Use `COALESCE(notification_email, email)` instead of non-existent `email_address`

  2. Purpose
    - Ensures the punch-in reminder function works correctly
    - Matches the logic pattern from the working punchout reminder function
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
      (up.first_name || ' ' || up.last_name) as full_name,
      COALESCE(up.notification_email, up.email) as email_address,
      check_date as schedule_date,
      ss.start_time,
      (check_date || ' ' || ss.start_time)::text as scheduled_start_datetime
    FROM staff_schedules ss
    JOIN user_profiles up ON up.user_id = ss.user_id
    WHERE ss.is_working_day = true
      AND ss.start_time IS NOT NULL
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if their start time was at least 10 minutes ago
      AND ss.start_time <= (check_time::time - interval '10 minutes')::time
      -- Make sure it's the right day of week (0=Sunday, 1=Monday, etc.)
      AND ss.day_of_week = EXTRACT(DOW FROM check_date)::integer
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
      (up.first_name || ' ' || up.last_name) as full_name,
      COALESCE(up.notification_email, up.email) as email_address,
      sso.override_date as schedule_date,
      sso.start_time,
      (sso.override_date || ' ' || sso.start_time)::text as scheduled_start_datetime
    FROM staff_schedule_overrides sso
    JOIN user_profiles up ON up.user_id = sso.user_id
    WHERE sso.override_date = check_date
      AND sso.status != 'off'
      AND sso.start_time IS NOT NULL
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_schedules_needing_reminders(date, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schedules_needing_reminders(date, time) TO service_role;
