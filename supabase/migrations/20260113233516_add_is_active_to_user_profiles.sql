/*
  # Add is_active column to user_profiles

  1. Changes
    - Add `is_active` (boolean) column to user_profiles table
    - Default value is true for all existing and new records
    - This field indicates whether a user profile is active in the system

  2. Notes
    - All existing users will be marked as active by default
    - This allows for soft-deletion and account deactivation functionality
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_active boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Create index for faster queries filtering by is_active
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
