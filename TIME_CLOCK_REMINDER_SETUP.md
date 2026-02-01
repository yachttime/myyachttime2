# Time Clock Reminder System

The automated time clock reminder system sends email notifications to staff members who haven't punched in 10 minutes after their scheduled start time.

## How It Works

1. **Schedule Monitoring**: Every 10 minutes, the system checks which staff are scheduled to work
2. **Punch-In Verification**: Checks if staff have clocked in via the time clock
3. **Reminder Dispatch**: Sends email reminders to staff who are late punching in
4. **Tracking**: Records all reminders sent to prevent duplicate notifications

## Components

### Database Tables

- **`time_clock_reminders`**: Tracks all reminders sent to staff
- **`staff_schedules`**: Regular weekly schedules for staff
- **`staff_schedule_overrides`**: Special schedule changes for specific dates
- **`staff_time_entries`**: Time clock punch records

### Database Function

- **`get_schedules_needing_reminders()`**: Finds staff who need reminders by:
  - Checking regular schedules and overrides
  - Excluding staff with approved time off
  - Only returning staff who haven't punched in yet
  - Filtering for shifts that started 10+ minutes ago

### Edge Function

- **`check-time-clock-reminders`**: Sends reminder emails via Resend API

## Setup Instructions

### Option 1: Supabase Platform Cron (Recommended)

1. Log into your Supabase Dashboard
2. Go to **Database** → **Cron Jobs**
3. Click **Create a new cron job**
4. Configure:
   - **Name**: `check-time-clock-reminders`
   - **Schedule**: `*/10 * * * *` (every 10 minutes)
   - **Command**:
     ```sql
     SELECT net.http_post(
       url := 'YOUR_SUPABASE_URL/functions/v1/check-time-clock-reminders',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     );
     ```
   - Replace `YOUR_SUPABASE_URL` with your actual project URL

### Option 2: Manual Trigger (For Testing)

You can manually trigger the reminder check by calling the edge function:

```bash
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/check-time-clock-reminders \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Option 3: Use pg_cron Extension

The system includes a pre-configured pg_cron setup. To activate it:

1. Update the `call_time_clock_reminder_check()` function with your Supabase URL:

```sql
-- Update the function with your actual Supabase URL
CREATE OR REPLACE FUNCTION call_time_clock_reminder_check()
RETURNS void AS $$
DECLARE
  response_id bigint;
BEGIN
  SELECT INTO response_id net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-time-clock-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. The cron job is already scheduled to run every 10 minutes

## Email Configuration

Reminder emails are sent using the Resend API. The system uses the `RESEND_API_KEY` environment variable (automatically configured in Supabase Edge Functions).

### Email Content

Staff receive an email with:
- Notification that they were scheduled to work
- Their scheduled start time
- Reminder to punch in via the Time Clock
- Direct link to the application

## Monitoring

### View Reminder History

Master role users can query reminder history:

```sql
SELECT
  tcr.schedule_date,
  up.full_name,
  tcr.scheduled_start_time,
  tcr.reminder_sent_at,
  tcr.punched_in_at
FROM time_clock_reminders tcr
JOIN user_profiles up ON up.user_id = tcr.user_id
ORDER BY tcr.reminder_sent_at DESC;
```

### Check Who Needs Reminders Right Now

```sql
SELECT * FROM get_schedules_needing_reminders(
  CURRENT_DATE,
  (CURRENT_TIME - INTERVAL '10 minutes')::time
);
```

## Troubleshooting

### Reminders Not Sending

1. **Check the cron job is running**: Query `cron.job_run_details` table
2. **Verify edge function is deployed**: Check Supabase Functions dashboard
3. **Check email configuration**: Ensure RESEND_API_KEY is configured
4. **Review function logs**: Check edge function logs for errors

### False Reminders

If staff are receiving reminders after punching in:
- Verify time clock entries are being recorded correctly
- Check that `staff_time_entries` table has the correct `date` and `clock_in` values
- Ensure staff are using the correct date/time zone

### Missing Reminders

If staff aren't receiving reminders when they should:
- Verify staff schedules are configured correctly in `staff_schedules` or `staff_schedule_overrides`
- Check that staff members have `is_active = true` in `user_profiles`
- Ensure staff have valid email addresses in the `email_address` field

## Customization

### Change Reminder Delay

To change from 10 minutes to a different delay, update:

1. **Edge function**: Modify the `10 * 60 * 1000` calculation
2. **Database function**: Change the `interval '10 minutes'` in `get_schedules_needing_reminders()`

### Customize Email Template

Edit the email HTML in the edge function at:
`supabase/functions/check-time-clock-reminders/index.ts`

Look for the `html` property in the Resend API call.
