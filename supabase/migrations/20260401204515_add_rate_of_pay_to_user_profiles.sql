/*
  # Add Rate of Pay to User Profiles

  1. Changes
    - Adds `rate_of_pay` (numeric) column to `user_profiles` table
    - Nullable, no default — only applicable to staff/mechanic/master roles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'rate_of_pay'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN rate_of_pay numeric(10,2) DEFAULT NULL;
  END IF;
END $$;
