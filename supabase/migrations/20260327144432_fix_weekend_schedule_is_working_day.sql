/*
  # Fix Weekend Schedule is_working_day Flag

  ## Problem
  Several staff members have is_working_day = true for Saturday (day_of_week = 6) and
  Sunday (day_of_week = 0) even though they are not scheduled to work weekends. This
  caused the time clock reminder system to send false "you haven't punched in" notifications
  on weekends when no one was actually scheduled.

  ## Fix
  Set is_working_day = false and clear start_time/end_time for any weekend schedule rows
  where is_working_day is true but start_time/end_time match the default 08:00-17:00 pattern,
  indicating they were never intentionally set as working days.

  Affected employees: BO Cole, jeff Stanley, JOSHUA BUCKLEY, Levi Kleck, PATRICH WHITE
*/

UPDATE staff_schedules
SET 
  is_working_day = false,
  start_time = NULL,
  end_time = NULL
WHERE day_of_week IN (0, 6)
  AND is_working_day = true
  AND start_time = '08:00:00'
  AND end_time = '17:00:00';
