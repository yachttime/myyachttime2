/*
  # Fix Time Clock Reminder to Use net.http_post

  1. Changes
    - Update `call_time_clock_reminder_check` to use `net.http_post` instead of `extensions.http_post`
    - Use correct function signature: http_post(url, body, params, headers, timeout)

  2. Purpose
    - Fixes the "function extensions.http_post does not exist" error
    - Allows the cron job to successfully call the edge function
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

  -- Make HTTP POST request to edge function using net.http_post
  BEGIN
    SELECT INTO response_id net.http_post(
      url := supabase_url || '/functions/v1/check-time-clock-reminders',
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log errors
    INSERT INTO time_clock_reminder_job_log (status, details)
    VALUES ('error', jsonb_build_object(
      'error', SQLERRM,
      'timestamp', now()
    ));
    RETURN;
  END;

  -- Log the request if successful
  INSERT INTO time_clock_reminder_job_log (status, details)
  VALUES ('success', jsonb_build_object(
    'response_id', response_id,
    'timestamp', now()
  ));
END;
$$;
