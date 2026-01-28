/*
  # Add Foreign Key for Trip Inspections Inspector

  1. Changes
    - Add foreign key constraint linking trip_inspections.inspector_id to user_profiles.user_id
    
  2. Security
    - This enables Supabase to properly establish relationships for queries
    - Ensures data integrity between inspectors and their inspections
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trip_inspections_inspector_id_fkey'
    AND table_name = 'trip_inspections'
  ) THEN
    ALTER TABLE trip_inspections
      ADD CONSTRAINT trip_inspections_inspector_id_fkey
      FOREIGN KEY (inspector_id)
      REFERENCES user_profiles(user_id)
      ON DELETE SET NULL;
  END IF;
END $$;
