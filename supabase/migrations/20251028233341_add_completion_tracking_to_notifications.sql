/*
  # Add Completion Tracking to Admin Notifications

  1. Changes
    - Add `completed_by` column to `admin_notifications` table to track which user marked it complete
    - Add `completed_at` column to `admin_notifications` table to track when it was completed
  
  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_notifications' AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE admin_notifications ADD COLUMN completed_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_notifications' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE admin_notifications ADD COLUMN completed_at timestamptz;
  END IF;
END $$;