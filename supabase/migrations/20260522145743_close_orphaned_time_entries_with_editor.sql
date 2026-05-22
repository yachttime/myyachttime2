/*
  # Close Orphaned Time Entries

  ## Problem
  Multiple staff_time_entries rows exist with punch_out_time IS NULL going back to
  February 2026. Employees say they punched out but the database never received the
  write. This prevents them from punching in again.

  ## Changes
  - Closes all open entries from before today (May 22 2026) at 11 PM UTC on their
    punch-in day.
  - Sets edited_by to the master admin user so the audit trigger is satisfied.
  - Marks is_edited=true with a clear edit_reason for the audit trail.
  - Today's open entries (May 22) are NOT touched — those employees are actively working.
*/

UPDATE staff_time_entries
SET
  punch_out_time = (date_trunc('day', punch_in_time) + interval '23 hours'),
  is_edited = true,
  edited_by = '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  edited_at = now(),
  edit_reason = 'Auto-closed by admin: punch-out was not recorded. Closed at 11 PM on punch-in day.'
WHERE
  punch_out_time IS NULL
  AND punch_in_time < '2026-05-22 00:00:00+00';
