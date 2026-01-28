/*
  # Add completion tracking to repair requests

  1. Changes
    - Add `completed_by` column to track which user completed the repair
    - Add `completed_at` column to track when the repair was completed
    - Both columns are nullable since they only apply to completed repairs

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN completed_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN completed_at timestamptz;
  END IF;
END $$;
