/*
  # Add Foreign Key from yacht_bookings to user_profiles

  1. Changes
    - Add foreign key constraint from yacht_bookings.user_id to user_profiles.user_id
    - This enables proper joins in queries to fetch user profile data with bookings
    
  2. Notes
    - yacht_bookings.user_id already references auth.users
    - user_profiles.user_id also references auth.users
    - This creates an additional relationship for easier querying
*/

-- Add foreign key from yacht_bookings.user_id to user_profiles.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'yacht_bookings_user_id_user_profiles_fkey'
  ) THEN
    ALTER TABLE yacht_bookings
    ADD CONSTRAINT yacht_bookings_user_id_user_profiles_fkey
    FOREIGN KEY (user_id) 
    REFERENCES user_profiles(user_id);
  END IF;
END $$;