/*
  # Fix staff_schedules rows with NULL company_id

  ## Problem
  The WorkScheduleModal in StaffCalendar.tsx upserted schedule rows without
  setting company_id. The SELECT policy "Users can view company schedules"
  requires `company_id = get_user_company_id()`, so those rows were invisible
  to the app after saving (and caused "Failed to save schedules" errors on
  reload). Seven existing rows have company_id = NULL.

  ## Changes
  1. Backfill: set company_id on staff_schedules rows from the corresponding
     user_profiles.company_id, so existing NULL rows become visible again.
  2. Add a trigger that auto-populates company_id from user_profiles on
     INSERT and UPDATE (when company_id is NULL or the user's company
     changes), preventing future NULL company_id rows.
*/

-- 1. Backfill NULL company_id rows from user_profiles
UPDATE staff_schedules ss
SET company_id = up.company_id
FROM user_profiles up
WHERE ss.user_id = up.user_id
  AND ss.company_id IS NULL
  AND up.company_id IS NOT NULL;

-- 2. Trigger function to auto-set company_id from user_profiles
CREATE OR REPLACE FUNCTION set_staff_schedule_company_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM user_profiles
    WHERE user_profiles.user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_staff_schedules_set_company_id ON staff_schedules;
CREATE TRIGGER trg_staff_schedules_set_company_id
  BEFORE INSERT OR UPDATE OF company_id, user_id ON staff_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_staff_schedule_company_id();
