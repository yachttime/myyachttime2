/*
  # Split Address into Components

  1. Changes
    - Remove `address` column from user_profiles table
    - Add `street` column to user_profiles table
    - Add `city` column to user_profiles table
    - Add `state` column to user_profiles table
    - Add `zip_code` column to user_profiles table

  2. Notes
    - All address components are optional text fields
    - This provides more structured address data for better querying and formatting
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'address'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN address;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'street'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN street text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'state'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'zip_code'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN zip_code text;
  END IF;
END $$;