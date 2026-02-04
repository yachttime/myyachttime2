/*
  # Fix Punch-Out Reminder Logic Bug

  1. Problem
    - Same bug as punch-in: uses `end_time <= (check_time - 10 minutes)`
    - Causes time wraparound issues at midnight
    - Result: Punch-out reminders sent at incorrect times

  2. Solution
    - Check if end_time is within a 20-minute window: between (check_time - 20 min) and (check_time - 10 min)
    - Matches the fix applied to punch-in reminders

  3. Security
    - No changes to RLS policies
    - Function remains SECURITY DEFINER with existing permissions
*/

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
      -- Check if their end time is between 20 and 10 minutes ago
      AND ss.end_time >= (check_time::time - interval '20 minutes')::time
      AND ss.end_time < (check_time::time - interval '10 minutes')::time
      AND ss.day_of_week = EXTRACT(DOW FROM check_date)::integer
      AND NOT EXISTS (
        SELECT 1 FROM staff_schedule_overrides sso
        WHERE sso.user_id = ss.user_id AND sso.override_date = check_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM staff_time_off_requests stor
        WHERE stor.user_id = ss.user_id AND stor.status = 'approved'
        AND check_date BETWEEN stor.start_date AND stor.end_date
      )

    UNION

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
      AND sso.status != 'off'
      AND sso.start_time IS NOT NULL
      AND sso.end_time IS NOT NULL
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if their end time is between 20 and 10 minutes ago
      AND sso.end_time >= (check_time::time - interval '20 minutes')::time
      AND sso.end_time < (check_time::time - interval '10 minutes')::time
      AND NOT EXISTS (
        SELECT 1 FROM staff_time_off_requests stor
        WHERE stor.user_id = sso.user_id AND stor.status = 'approved'
        AND check_date BETWEEN stor.start_date AND stor.end_date
      )
  )
  SELECT * FROM staff_should_punchout;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_schedules_needing_punchout_reminders(date, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schedules_needing_punchout_reminders(date, time) TO service_role;
