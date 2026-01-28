/*
  # Add Trash Removed Field to Trip Inspections

  1. Changes
    - Add `trash_removed` column to store condition status (ok/needs_service)
    - Add `trash_removed_notes` column to store additional notes
    
  2. Details
    - Both columns are text type and nullable
    - Fields will appear under Shore Cords in the Exterior Hull section
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trip_inspections' AND column_name = 'trash_removed'
  ) THEN
    ALTER TABLE trip_inspections ADD COLUMN trash_removed text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trip_inspections' AND column_name = 'trash_removed_notes'
  ) THEN
    ALTER TABLE trip_inspections ADD COLUMN trash_removed_notes text;
  END IF;
END $$;
