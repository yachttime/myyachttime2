/*
  # Fix Time Clock Reminder Cron Function URL

  1. Changes
    - Update the `call_time_clock_reminder_check` function to use the actual Supabase project URL
    - Replace placeholder URL with: https://eqiecntollhgfxmmbize.supabase.co

  2. Purpose
    - Ensures the cron job can successfully call the edge function
    - Fixes the issue preventing reminder emails from being sent
*/

CREATE OR REPLACE FUNCTION call_time_clock_reminder_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_id bigint;
  supabase_url text;
BEGIN
  -- Use the actual Supabase project URL
  supabase_url := 'https://eqiecntollhgfxmmbize.supabase.co';

  -- Make HTTP POST request to edge function using pg_net (if installed)
  -- If pg_net is not installed, this will fail silently
  BEGIN
    SELECT INTO response_id extensions.http_post(
      url := supabase_url || '/functions/v1/check-time-clock-reminders',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log errors if the table exists
    BEGIN
      INSERT INTO time_clock_reminder_job_log (status, details)
      VALUES ('error', jsonb_build_object(
        'error', SQLERRM,
        'timestamp', now()
      ));
    EXCEPTION WHEN OTHERS THEN
      -- Table doesn't exist, just log warning
      RAISE WARNING 'Error calling time clock reminder check: %', SQLERRM;
    END;
    RETURN;
  END;

  -- Log the request if successful
  BEGIN
    INSERT INTO time_clock_reminder_job_log (status, details)
    VALUES ('success', jsonb_build_object(
      'response_id', response_id,
      'timestamp', now()
    ));
  EXCEPTION WHEN OTHERS THEN
    -- Table doesn't exist, that's ok
    NULL;
  END;
END;
$$;
