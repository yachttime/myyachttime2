/*
  # Add secondary email to user profiles

  1. Changes
    - Add `secondary_email` column to `user_profiles` table
      - This email will be used as a CC when sending notifications to users
      - Optional field (nullable)
      - Must be a valid email format if provided
  
  2. Notes
    - Secondary email is for CC purposes only
    - Used when users want someone else to receive copies of their notifications
*/

-- Add secondary_email column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'secondary_email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN secondary_email text;
  END IF;
END $$;

-- Add check constraint to validate email format if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'user_profiles' AND constraint_name = 'valid_secondary_email'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT valid_secondary_email 
      CHECK (secondary_email IS NULL OR secondary_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;