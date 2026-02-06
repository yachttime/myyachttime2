/*
  # Fix Time Clock Reminder Detection Window - Core Issue

  1. Problem
    - Current logic checks for schedules in a narrow 10-minute window (20-10 minutes ago)
    - With cron running every 10 minutes, this means reminders only work if cron runs at ONE specific time
    - Example: 8:00 AM start only detected at 8:20 AM check, missed at 8:10, 8:30, 8:40, etc.
    - This causes daily failures because timing must be EXACTLY right
    
  2. Root Cause
    - Using window: start_time >= (check_time - 20 min) AND start_time < (check_time - 10 min)
    - Should be: check_time >= (start_time + 10 min) - i.e., "are we 10+ min past start?"
    
  3. Solution
    - Change to check if current time is at least 10 minutes past their start time
    - This works reliably regardless of when cron runs
    - More forgiving: catches anyone who should have punched in, not just narrow window
    
  4. Security
    - No changes to RLS policies
    - Function remains SECURITY DEFINER with existing permissions
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
    -- Get staff from regular schedules who are 10+ minutes late
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
      AND up.is_active = true
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      -- Check if current time is at least 10 minutes past their scheduled start time
      AND check_time >= (ss.start_time + interval '10 minutes')::time
      -- Make sure it's the right day of week (0 = Sunday, 1 = Monday, etc.)
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

    -- Get staff from schedule overrides who are 10+ minutes late
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
      -- Check if current time is at least 10 minutes past their scheduled start time
      AND check_time >= (sso.start_time + interval '10 minutes')::time
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

GRANT EXECUTE ON FUNCTION get_schedules_needing_reminders(date, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schedules_needing_reminders(date, time) TO service_role;
