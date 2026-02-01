/*
  # Fix Time Clock Reminder Cron Setup

  1. Updates
    - Drop and recreate the cron function with proper configuration
    - Use pg_net properly for HTTP requests
    - Add better error handling

  2. Purpose
    - Ensure the cron job can successfully call the edge function
    - Make it easier to configure with actual Supabase URL
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS call_time_clock_reminder_check();

-- Create improved function to call the edge function
CREATE OR REPLACE FUNCTION call_time_clock_reminder_check()
RETURNS void AS $$
DECLARE
  response_id bigint;
  supabase_url text;
BEGIN
  -- IMPORTANT: Replace this URL with your actual Supabase project URL
  -- Format: https://YOUR_PROJECT_REF.supabase.co
  supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';

  -- Make HTTP POST request to edge function using pg_net
  SELECT INTO response_id extensions.http_post(
    url := supabase_url || '/functions/v1/check-time-clock-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  -- Log the request
  INSERT INTO time_clock_reminder_job_log (status, details)
  VALUES ('success', jsonb_build_object(
    'response_id', response_id,
    'timestamp', now()
  ));

EXCEPTION WHEN OTHERS THEN
  -- Log errors
  INSERT INTO time_clock_reminder_job_log (status, details)
  VALUES ('error', jsonb_build_object(
    'error', SQLERRM,
    'timestamp', now()
  ));
  
  RAISE WARNING 'Error calling time clock reminder check: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION call_time_clock_reminder_check() TO postgres;

-- Recreate the cron job (if it exists, unschedule first)
DO $$
BEGIN
  -- Try to unschedule if it exists
  BEGIN
    PERFORM cron.unschedule('check-time-clock-reminders');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's ok
    NULL;
  END;

  -- Schedule the job to run every 10 minutes
  PERFORM cron.schedule(
    'check-time-clock-reminders',
    '*/10 * * * *',
    'SELECT call_time_clock_reminder_check();'
  );
END $$;
