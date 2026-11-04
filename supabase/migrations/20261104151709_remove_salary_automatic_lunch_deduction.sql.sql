/*
# Remove automatic lunch deduction for salary staff

1. Problem
- The time clock automatically subtracted 60 minutes of lunch from every salary shift longer than an hour, even when no lunch was taken.

2. Change
- `calculate_time_entry_hours` no longer applies the salary deduction.
- Hourly staff still have lunch subtracted only when a lunch break was actually recorded.
- Work order labor entries are still never reduced for lunch.
- Hours are still floored at zero and split into standard and overtime as before.

3. Notes
- Existing stored hours are not changed. Only new punch-outs and edits use the new rule.
- Idempotent: CREATE OR REPLACE.
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

    IF NEW.work_order_id IS NULL AND user_employee_type = 'hourly'
       AND NEW.lunch_break_start IS NOT NULL AND NEW.lunch_break_end IS NOT NULL THEN
      lunch_minutes := EXTRACT(EPOCH FROM (NEW.lunch_break_end - NEW.lunch_break_start)) / 60;
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
