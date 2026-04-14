/*
  # Fix calculate_time_entry_hours: prevent negative hours for salary employees

  ## Problem
  Salary employees automatically get a 60-minute lunch deduction. When a work-order
  labor entry is short (e.g., 30 min), the deduction produces a negative total_hours
  (e.g., -0.50), which corrupts payroll reports.

  ## Fix
  - Only apply the salary 60-minute lunch deduction if the shift is longer than 60 minutes.
  - Also never apply any lunch deduction to work_order entries (they are specific labor
    charges, not regular shifts).
  - Ensure total_hours is never stored as a negative value (floor at 0).
*/

CREATE OR REPLACE FUNCTION public.calculate_time_entry_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  work_minutes numeric;
  lunch_minutes numeric;
  total_minutes numeric;
  user_employee_type text;
BEGIN
  SELECT employee_type INTO user_employee_type
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  IF NEW.punch_out_time IS NOT NULL THEN
    work_minutes := EXTRACT(EPOCH FROM (NEW.punch_out_time - NEW.punch_in_time)) / 60;

    lunch_minutes := 0;

    IF NEW.work_order_id IS NULL THEN
      IF user_employee_type = 'hourly' AND NEW.lunch_break_start IS NOT NULL AND NEW.lunch_break_end IS NOT NULL THEN
        lunch_minutes := EXTRACT(EPOCH FROM (NEW.lunch_break_end - NEW.lunch_break_start)) / 60;
      END IF;

      IF user_employee_type = 'salary' AND work_minutes > 60 THEN
        lunch_minutes := 60;
      END IF;
    END IF;

    total_minutes := work_minutes - lunch_minutes;
    NEW.total_hours := ROUND((GREATEST(total_minutes, 0) / 60)::numeric, 2);

    IF NEW.total_hours <= 8 THEN
      NEW.standard_hours := NEW.total_hours;
      NEW.overtime_hours := 0;
    ELSE
      NEW.standard_hours := 8;
      NEW.overtime_hours := NEW.total_hours - 8;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
