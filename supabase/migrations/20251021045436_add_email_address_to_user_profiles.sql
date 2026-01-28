/*
  # Add Email and Address to User Profiles

  1. Changes
    - Add `email` column to user_profiles table
    - Add `address` column to user_profiles table
    - Both columns are optional text fields

  2. Notes
    - Email can be used for contact purposes separate from auth email
    - Address stores user's physical address
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'address'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN address text;
  END IF;
END $$;