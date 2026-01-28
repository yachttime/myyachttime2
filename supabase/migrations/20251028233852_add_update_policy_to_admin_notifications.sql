/*
  # Add UPDATE Policy to Admin Notifications

  1. Changes
    - Add UPDATE policy to `admin_notifications` table to allow staff to mark messages as complete
  
  2. Security
    - Only authenticated users with staff, manager, or mechanic roles can update notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_notifications' 
    AND policyname = 'Staff can update admin notifications'
  ) THEN
    CREATE POLICY "Staff can update admin notifications"
      ON admin_notifications
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role IN ('staff', 'manager', 'mechanic')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role IN ('staff', 'manager', 'mechanic')
        )
      );
  END IF;
END $$;