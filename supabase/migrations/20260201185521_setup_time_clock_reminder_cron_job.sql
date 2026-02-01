/*
  # Setup Automated Time Clock Reminder Cron Job

  1. Extensions
    - Enable pg_cron extension for scheduled jobs

  2. Cron Jobs
    - Create a cron job that runs every 10 minutes
    - Calls the check-time-clock-reminders edge function
    - Uses pg_net extension to make HTTP requests

  3. Purpose
    - Automatically check staff schedules every 10 minutes
    - Send reminders to staff who haven't punched in 10+ minutes after their scheduled start time
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to call the edge function
CREATE OR REPLACE FUNCTION call_time_clock_reminder_check()
RETURNS void AS $$
DECLARE
  supabase_url text;
  supabase_anon_key text;
  response_id bigint;
BEGIN
  -- Get Supabase URL from vault or use default
  supabase_url := current_setting('app.settings.supabase_url', true);
  IF supabase_url IS NULL THEN
    -- Fallback: construct from current database
    supabase_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co';
  END IF;

  -- Get anon key from vault
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Make HTTP request to edge function using pg_net
  SELECT INTO response_id net.http_post(
    url := supabase_url || '/functions/v1/check-time-clock-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := '{}'::jsonb
  );

  -- Log the request
  RAISE NOTICE 'Time clock reminder check initiated: response_id=%', response_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error calling time clock reminder check: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run every 10 minutes
-- This will check at :00, :10, :20, :30, :40, :50 of each hour
SELECT cron.schedule(
  'check-time-clock-reminders',
  '*/10 * * * *',
  $$SELECT call_time_clock_reminder_check();$$
);

-- Create a table to track cron job execution history (optional but useful)
CREATE TABLE IF NOT EXISTS time_clock_reminder_job_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz DEFAULT now(),
  status text,
  details jsonb
);

-- Enable RLS on the log table
ALTER TABLE time_clock_reminder_job_log ENABLE ROW LEVEL SECURITY;

-- Policy: Master role can view job logs
CREATE POLICY "Master can view reminder job logs"
  ON time_clock_reminder_job_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Create an index for the log table
CREATE INDEX IF NOT EXISTS idx_reminder_job_log_executed_at 
  ON time_clock_reminder_job_log(executed_at DESC);

-- Grant permissions
GRANT EXECUTE ON FUNCTION call_time_clock_reminder_check() TO postgres;
