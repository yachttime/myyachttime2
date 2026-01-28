/*
  # Add Sign-In/Sign-Out Tracking to User Profiles

  1. Changes
    - Add `last_sign_in_at` (timestamptz, nullable) - Tracks when user last signed in
    - Add `last_sign_out_at` (timestamptz, nullable) - Tracks when user last signed out
    
  2. Notes
    - These fields will be updated by the application when users sign in/out
    - Null values indicate user has never signed in/out
    - Useful for monitoring user activity and security
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_sign_in_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_sign_in_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_sign_out_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_sign_out_at timestamptz;
  END IF;
END $$;