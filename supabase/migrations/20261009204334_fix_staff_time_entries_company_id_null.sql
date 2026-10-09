/*
  # Fix staff_time_entries rows with NULL company_id

  ## Problem
  The AddEntryModal in TimecardView.tsx inserted time entries without
  setting company_id. The SELECT policy "Users can view company staff time
  entries" requires `company_id = get_user_company_id() OR user_id = auth.uid()`.
  When a master adds an entry for another employee, user_id != auth.uid(),
  so a NULL company_id makes the row invisible after saving.

  ## Changes
  1. Backfill: set company_id on staff_time_entries rows from user_profiles.
  2. Add a trigger to auto-populate company_id from user_profiles on
     INSERT and UPDATE, preventing future NULL company_id rows.
*/

-- 1. Backfill NULL company_id rows from user_profiles
UPDATE staff_time_entries ste
SET company_id = up.company_id
FROM user_profiles up
WHERE ste.user_id = up.user_id
  AND ste.company_id IS NULL
  AND up.company_id IS NOT NULL;

-- 2. Trigger function to auto-set company_id from user_profiles
CREATE OR REPLACE FUNCTION set_staff_time_entry_company_id()
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

DROP TRIGGER IF EXISTS trg_staff_time_entries_set_company_id ON staff_time_entries;
CREATE TRIGGER trg_staff_time_entries_set_company_id
  BEFORE INSERT OR UPDATE OF company_id, user_id ON staff_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_staff_time_entry_company_id();
