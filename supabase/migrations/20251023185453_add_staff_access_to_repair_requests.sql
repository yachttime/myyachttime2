/*
  # Add staff access to repair requests

  1. Changes
    - Add SELECT policy to allow staff to view all repair requests
    - Add UPDATE policy to allow staff to update repair requests
    
  2. Security
    - Staff can view all repair requests across all yachts
    - Staff can update repair requests (for approval workflows)
*/

-- Allow staff to view all repair requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'repair_requests' 
    AND policyname = 'Staff can view all repair requests'
  ) THEN
    CREATE POLICY "Staff can view all repair requests"
      ON repair_requests
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role = 'staff'
        )
      );
  END IF;
END $$;

-- Allow staff to update repair requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'repair_requests' 
    AND policyname = 'Staff can update repair requests'
  ) THEN
    CREATE POLICY "Staff can update repair requests"
      ON repair_requests
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role = 'staff'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role = 'staff'
        )
      );
  END IF;
END $$;
