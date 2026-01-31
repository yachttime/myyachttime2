/*
  # Add Reference Tracking to Time Clock Entries

  ## Overview
  Links time clock entries to related records like trip inspections and owner handoff inspections,
  similar to how yacht_history_logs tracks references.

  ## Changes
  1. New Columns to `staff_time_entries`
    - `reference_id` (uuid) - stores references to related records (inspections, forms, etc.)
    - `reference_type` (text) - identifies the type of reference (e.g., 'trip_inspection', 'owner_handoff_inspection')

  ## Notes
  - These fields are optional and allow viewing which forms were completed during a time clock session
  - Enables "View PDF" functionality from time entries, similar to yacht history logs
  - Helps track employee productivity and work performed during shifts
*/

-- Add reference columns to staff_time_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_time_entries' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE staff_time_entries ADD COLUMN reference_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_time_entries' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE staff_time_entries ADD COLUMN reference_type text;
  END IF;
END $$;

-- Create index for efficient reference lookups
CREATE INDEX IF NOT EXISTS idx_staff_time_entries_reference ON staff_time_entries(reference_id, reference_type);

-- Function to link trip inspections to active time entry
CREATE OR REPLACE FUNCTION link_trip_inspection_to_time_entry()
RETURNS trigger AS $$
DECLARE
  active_entry_id uuid;
BEGIN
  -- Find the most recent active (not punched out) time entry for this inspector on the inspection date
  SELECT id INTO active_entry_id
  FROM staff_time_entries
  WHERE user_id = NEW.inspector_id
    AND DATE(punch_in_time) = DATE(NEW.inspection_date)
    AND punch_out_time IS NULL
  ORDER BY punch_in_time DESC
  LIMIT 1;

  -- If an active entry exists, link the inspection to it
  IF active_entry_id IS NOT NULL THEN
    UPDATE staff_time_entries
    SET reference_id = NEW.id,
        reference_type = 'trip_inspection'
    WHERE id = active_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to link owner handoff inspections to active time entry
CREATE OR REPLACE FUNCTION link_owner_handoff_to_time_entry()
RETURNS trigger AS $$
DECLARE
  active_entry_id uuid;
BEGIN
  -- Find the most recent active (not punched out) time entry for this inspector on the inspection date
  SELECT id INTO active_entry_id
  FROM staff_time_entries
  WHERE user_id = NEW.inspector_id
    AND DATE(punch_in_time) = DATE(NEW.inspection_date)
    AND punch_out_time IS NULL
  ORDER BY punch_in_time DESC
  LIMIT 1;

  -- If an active entry exists, link the inspection to it
  IF active_entry_id IS NOT NULL THEN
    UPDATE staff_time_entries
    SET reference_id = NEW.id,
        reference_type = 'owner_handoff_inspection'
    WHERE id = active_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically link inspections to time entries
DROP TRIGGER IF EXISTS link_trip_inspection_trigger ON trip_inspections;
CREATE TRIGGER link_trip_inspection_trigger
  AFTER INSERT ON trip_inspections
  FOR EACH ROW
  EXECUTE FUNCTION link_trip_inspection_to_time_entry();

DROP TRIGGER IF EXISTS link_owner_handoff_trigger ON owner_handoff_inspections;
CREATE TRIGGER link_owner_handoff_trigger
  AFTER INSERT ON owner_handoff_inspections
  FOR EACH ROW
  EXECUTE FUNCTION link_owner_handoff_to_time_entry();
