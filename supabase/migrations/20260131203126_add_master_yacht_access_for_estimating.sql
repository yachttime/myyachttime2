/*
  # Add Master User Access to Yachts for Estimating System

  1. Changes
    - Add policy for master users to view all yachts
    - This allows the estimating system yacht dropdown to work properly

  2. Security
    - Master users can view all yachts for creating estimates
    - Maintains existing security for other roles
*/

-- Add policy for master users to view all yachts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'yachts' 
    AND policyname = 'Master users can view all yachts'
  ) THEN
    CREATE POLICY "Master users can view all yachts"
      ON yachts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role = 'master'
          AND user_profiles.is_active = true
        )
      );
  END IF;
END $$;