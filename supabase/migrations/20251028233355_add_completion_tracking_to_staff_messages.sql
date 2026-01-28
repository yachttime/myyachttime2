/*
  # Add Completion Tracking to Staff Messages

  1. Changes
    - Add `completed_by` column to `staff_messages` table to track which user marked it complete
    - Add `completed_at` column to `staff_messages` table to track when it was completed
  
  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN completed_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_messages' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE staff_messages ADD COLUMN completed_at timestamptz;
  END IF;
END $$;