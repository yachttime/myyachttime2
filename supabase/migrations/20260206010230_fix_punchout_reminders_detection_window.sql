/*
  # Fix Punch-Out Reminder Detection Window

  1. Problem
    - Current logic checks for end times in a narrow 10-20 minute window
    - With cron running every 10 minutes, people can easily be missed
    - Example: If someone's end time is 5:00 PM and cron runs at 5:20 PM, they're missed
    
  2. Solution
    - Change logic to check for anyone currently punched in who is past their end time by 10+ minutes
    - More reliable: catches anyone who should have punched out, regardless of when cron runs
    - Still uses the 10-minute grace period before sending reminder
    
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
    -- Get staff from regular schedules who are past their end time
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
      -- Check if current time is at least 10 minutes past their scheduled end time
      AND check_time >= (ss.end_time + interval '10 minutes')::time
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

    -- Get staff from schedule overrides who are past their end time
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
      -- Check if current time is at least 10 minutes past their scheduled end time
      AND check_time >= (sso.end_time + interval '10 minutes')::time
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
