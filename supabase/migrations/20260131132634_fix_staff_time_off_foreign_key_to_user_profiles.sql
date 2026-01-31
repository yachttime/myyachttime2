/*
  # Fix Foreign Key for Staff Time Off Requests

  1. Changes
    - Drop existing foreign key from staff_time_off_requests.user_id to auth.users
    - Add new foreign key from staff_time_off_requests.user_id to user_profiles.user_id
    - This allows PostgREST to properly join staff_time_off_requests with user_profiles
  
  2. Impact
    - Enables the calendar view to fetch staff member details (first_name, last_name, role)
    - Maintains data integrity by ensuring user_id exists in user_profiles
*/

-- Drop the existing foreign key constraint to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_time_off_requests_user_id_fkey'
    AND table_name = 'staff_time_off_requests'
  ) THEN
    ALTER TABLE staff_time_off_requests DROP CONSTRAINT staff_time_off_requests_user_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_time_off_requests_user_id_user_profiles_fkey'
    AND table_name = 'staff_time_off_requests'
  ) THEN
    ALTER TABLE staff_time_off_requests
      ADD CONSTRAINT staff_time_off_requests_user_id_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Do the same for staff_schedules
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_schedules_user_id_fkey'
    AND table_name = 'staff_schedules'
  ) THEN
    ALTER TABLE staff_schedules DROP CONSTRAINT staff_schedules_user_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_schedules_user_id_user_profiles_fkey'
    AND table_name = 'staff_schedules'
  ) THEN
    ALTER TABLE staff_schedules
      ADD CONSTRAINT staff_schedules_user_id_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Do the same for reviewed_by field
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_time_off_requests_reviewed_by_fkey'
    AND table_name = 'staff_time_off_requests'
  ) THEN
    ALTER TABLE staff_time_off_requests DROP CONSTRAINT staff_time_off_requests_reviewed_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_time_off_requests_reviewed_by_user_profiles_fkey'
    AND table_name = 'staff_time_off_requests'
  ) THEN
    ALTER TABLE staff_time_off_requests
      ADD CONSTRAINT staff_time_off_requests_reviewed_by_user_profiles_fkey
      FOREIGN KEY (reviewed_by) REFERENCES user_profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;
