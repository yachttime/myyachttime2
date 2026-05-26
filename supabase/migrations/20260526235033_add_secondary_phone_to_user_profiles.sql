/*
  # Add secondary phone to user profiles

  Adds a `secondary_phone` text column to `user_profiles` for an optional
  alternate contact number displayed on the user profile card.

  ## Changes
  - `user_profiles`: new nullable `secondary_phone` column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'secondary_phone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN secondary_phone text DEFAULT NULL;
  END IF;
END $$;
