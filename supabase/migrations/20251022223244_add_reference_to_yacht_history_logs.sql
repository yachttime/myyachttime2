/*
  # Add reference_id and reference_type to yacht_history_logs

  1. Changes
    - Add `reference_id` (uuid) column to store references to related records (inspections, bookings, etc.)
    - Add `reference_type` (text) column to identify the type of reference (e.g., 'trip_inspection', 'booking', 'repair_request')

  2. Notes
    - These fields are optional and will be used to link activity logs to their source records
    - This allows displaying contextual actions like "View PDF" for inspections
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_history_logs' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE yacht_history_logs ADD COLUMN reference_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_history_logs' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE yacht_history_logs ADD COLUMN reference_type text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_reference ON yacht_history_logs(reference_id, reference_type);
