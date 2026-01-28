/*
  # Add Mechanic Role to User Profiles

  1. Changes
    - Add 'mechanic' as a new role option to the user_role enum type
    - This allows mechanics to be added as users in the system
  
  2. Notes
    - Mechanics can be assigned to repair requests and maintenance tasks
    - The role will be available immediately for new user profiles
    - Existing users are not affected
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'mechanic' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'mechanic';
  END IF;
END $$;