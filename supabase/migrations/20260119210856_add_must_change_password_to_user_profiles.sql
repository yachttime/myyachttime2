/*
  # Add Must Change Password Field

  1. Changes
    - Add `must_change_password` boolean field to `user_profiles` table
    - Defaults to false for existing users
    - New users created by staff will have this set to true

  2. Purpose
    - Force users to change their password on first login
    - Enhances security by ensuring default passwords are changed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN must_change_password boolean DEFAULT false;
  END IF;
END $$;