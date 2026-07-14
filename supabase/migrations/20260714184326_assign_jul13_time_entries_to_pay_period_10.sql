/*
# Assign July 13 work order time entries to Pay Period 10

## Summary
Time entries pushed to the time clock on 2026-07-13 (from work orders) were not assigned
to any pay period. These entries should belong to Pay Period 10 (2026-06-26 to 2026-07-10)
per business decision, even though the punch_in_time falls outside period 10's date range.

## Changes
- Updates staff_time_entries where punch_in_time is on 2026-07-13 and pay_period_id is null
  to set pay_period_id to period 10's ID (4d0a6948-e610-431f-8b4d-a94273069cf1).

## Important Notes
1. This is a data correction — the hours were pushed on 07/13 but represent work that
   should be paid in period 10.
2. Only entries with null pay_period_id are affected (not already assigned elsewhere).
*/

UPDATE staff_time_entries
SET pay_period_id = '4d0a6948-e610-431f-8b4d-a94273069cf1'
WHERE punch_in_time::date = '2026-07-13'
  AND pay_period_id IS NULL;
