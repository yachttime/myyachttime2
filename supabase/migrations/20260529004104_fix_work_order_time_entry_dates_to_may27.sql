/*
  # Fix work order time entry dates pushed on 2026-05-29

  All labor hours pushed from work orders today (2026-05-29) defaulted to
  today's date instead of the pay period May 12–27. This migration moves
  those entries to 2026-05-27 (last day of that pay period) so they appear
  in the correct payroll report.

  Only affects entries that:
    - Were created today (2026-05-29)
    - Have reference_type = 'work_order_line_item'
    - Have punch_in_time on 2026-05-29
*/

UPDATE staff_time_entries
SET
  punch_in_time  = (DATE '2026-05-27' + (punch_in_time::time)),
  punch_out_time = (DATE '2026-05-27' + (punch_out_time::timetz))
WHERE
  reference_type = 'work_order_line_item'
  AND created_at >= '2026-05-29 00:00:00+00'
  AND created_at <  '2026-05-30 00:00:00+00'
  AND punch_in_time >= '2026-05-29 00:00:00+00'
  AND punch_in_time <  '2026-05-30 00:00:00+00';
