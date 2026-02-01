# Quick Start: Time Clock Reminders

## What Was Built

The system now automatically sends email reminders to staff who haven't punched in 10 minutes after their scheduled start time.

## Final Setup Step

**You need to configure your Supabase URL in the database function.**

Run this SQL command in your Supabase SQL Editor:

```sql
-- Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- You can find this in your Supabase dashboard URL: https://YOUR_PROJECT_REF.supabase.co

CREATE OR REPLACE FUNCTION call_time_clock_reminder_check()
RETURNS void AS $$
DECLARE
  response_id bigint;
  supabase_url text;
BEGIN
  -- UPDATE THIS LINE with your actual project URL
  supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';

  SELECT INTO response_id extensions.http_post(
    url := supabase_url || '/functions/v1/check-time-clock-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  INSERT INTO time_clock_reminder_job_log (status, details)
  VALUES ('success', jsonb_build_object(
    'response_id', response_id,
    'timestamp', now()
  ));

EXCEPTION WHEN OTHERS THEN
  INSERT INTO time_clock_reminder_job_log (status, details)
  VALUES ('error', jsonb_build_object(
    'error', SQLERRM,
    'timestamp', now()
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## How It Works

1. **Every 10 minutes**, a cron job runs automatically
2. **Checks schedules**: Looks for staff who should have started work
3. **Verifies punch-ins**: Checks if they've clocked in
4. **Sends emails**: Sends reminder emails to those who haven't punched in

## Test It Manually

To test without waiting for the cron schedule:

```sql
SELECT call_time_clock_reminder_check();
```

Or call the edge function directly:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-time-clock-reminders
```

## View Reminder History

```sql
SELECT
  tcr.schedule_date,
  up.full_name,
  tcr.scheduled_start_time,
  tcr.reminder_sent_at
FROM time_clock_reminders tcr
JOIN user_profiles up ON up.user_id = tcr.user_id
ORDER BY tcr.reminder_sent_at DESC
LIMIT 20;
```

## Check Cron Job Status

```sql
-- View scheduled jobs
SELECT * FROM cron.job;

-- View job execution history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- View custom job logs
SELECT * FROM time_clock_reminder_job_log
ORDER BY executed_at DESC
LIMIT 10;
```

## Troubleshooting

**No reminders being sent?**
1. Verify the cron job is running: Check `cron.job` table
2. Check the edge function is deployed: Look in Supabase Functions dashboard
3. Review logs: Check `time_clock_reminder_job_log` table

**Staff getting reminders after punching in?**
- Make sure time entries are being recorded with the correct date
- Check the staff member's schedule matches their actual shift times

**Need to change the 10-minute delay?**
- Edit the edge function in `supabase/functions/check-time-clock-reminders/index.ts`
- Update the database function `get_schedules_needing_reminders()`

## What's Next

The system is now ready to automatically monitor schedules and send reminders. Staff like Jeff Stanley will receive email notifications if they forget to punch in within 10 minutes of their scheduled start time.
