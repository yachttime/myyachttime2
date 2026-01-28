/*
  # Allow Managers to View Trip Inspections

  1. Changes
    - Add SELECT policy for managers to view all trip inspections
    
  2. Security
    - Managers need to view trip inspections to manage yacht operations
    - This policy allows users with 'manager' role to view all inspections
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trip_inspections' 
    AND policyname = 'Managers can view all inspections'
  ) THEN
    CREATE POLICY "Managers can view all inspections"
      ON trip_inspections
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role = 'manager'
        )
      );
  END IF;
END $$;
