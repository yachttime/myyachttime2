/*
  # Fix Punch-Out Reminders Day of Week Matching

  1. Problem
    - The get_schedules_needing_punchout_reminders() function was checking day_of_week as TEXT
    - But staff_schedules table stores day_of_week as INTEGER (0-6)
    - This caused the function to never find matching schedules

  2. Solution
    - Update function to properly match INTEGER day_of_week values
    - 0 = Sunday, 1 = Monday, etc.
*/

-- Drop and recreate the function with correct day_of_week matching
DROP FUNCTION IF EXISTS get_schedules_needing_punchout_reminders(date, time);

CREATE OR REPLACE FUNCTION get_schedules_needing_punchout_reminders(
  check_date date,
  check_time time
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email_address text,
  schedule_date date,
  end_time time,
  scheduled_end_datetime text
) AS $$
BEGIN
  RETURN QUERY
  WITH staff_should_punchout AS (
    -- Get staff from regular schedules who should punch out
    SELECT 
      ss.user_id,
      (up.first_name || ' ' || up.last_name) as full_name,
      COALESCE(up.notification_email, up.email) as email_address,
      check_date as schedule_date,
      ss.end_time,
      (check_date || ' ' || ss.end_time)::text as scheduled_end_datetime
    FROM staff_schedules ss
    JOIN user_profiles up ON up.user_id = ss.user_id
    WHERE ss.is_working_day = true
      AND ss.end_time IS NOT NULL
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if their end time was at least 10 minutes ago
      AND ss.end_time <= (check_time::time - interval '10 minutes')::time
      -- Match the correct day of week (0 = Sunday, 1 = Monday, etc.)
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

    -- Get staff from schedule overrides who should punch out
    SELECT 
      sso.user_id,
      (up.first_name || ' ' || up.last_name) as full_name,
      COALESCE(up.notification_email, up.email) as email_address,
      sso.override_date as schedule_date,
      sso.end_time,
      (sso.override_date || ' ' || sso.end_time)::text as scheduled_end_datetime
    FROM staff_schedule_overrides sso
    JOIN user_profiles up ON up.user_id = sso.user_id
    WHERE sso.override_date = check_date
      AND sso.is_working_day = true
      AND sso.end_time IS NOT NULL
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if their end time was at least 10 minutes ago
      AND sso.end_time <= (check_time::time - interval '10 minutes')::time
      -- Check if they don't have approved time off
      AND NOT EXISTS (
        SELECT 1 FROM staff_time_off_requests stor
        WHERE stor.user_id = sso.user_id
        AND stor.status = 'approved'
        AND check_date BETWEEN stor.start_date AND stor.end_date
      )
  )
  SELECT * FROM staff_should_punchout;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_schedules_needing_punchout_reminders(date, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schedules_needing_punchout_reminders(date, time) TO service_role;
