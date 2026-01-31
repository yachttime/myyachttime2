/*
  # Fix Staff Schedule Overrides Foreign Keys

  1. Issues Fixed
    - Change user_id foreign key to reference user_profiles instead of auth.users
    - Change created_by foreign key to reference user_profiles instead of auth.users
    - This allows proper joins in queries with user profile data

  2. Changes
    - Drop existing foreign key constraints
    - Add new foreign key constraints pointing to user_profiles
    - Maintain ON DELETE CASCADE behavior

  3. Security
    - No change to RLS policies
    - Maintains data integrity with proper cascading deletes
*/

-- Drop existing foreign keys
ALTER TABLE staff_schedule_overrides
  DROP CONSTRAINT IF EXISTS staff_schedule_overrides_user_id_fkey;

ALTER TABLE staff_schedule_overrides
  DROP CONSTRAINT IF EXISTS staff_schedule_overrides_created_by_fkey;

-- Add new foreign keys pointing to user_profiles
ALTER TABLE staff_schedule_overrides
  ADD CONSTRAINT staff_schedule_overrides_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE staff_schedule_overrides
  ADD CONSTRAINT staff_schedule_overrides_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_profiles(user_id) ON DELETE CASCADE;
