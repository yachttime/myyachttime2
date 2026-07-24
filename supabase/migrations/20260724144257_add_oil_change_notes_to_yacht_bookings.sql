/*
# Add oil_change_notes column to yacht_bookings

## Purpose
Adds a free-text notes field so staff can give employees guidance/instructions
when a trip is marked as needing an oil change (oil_change_needed = true).

## Changes
1. New column on `yacht_bookings`:
   - `oil_change_notes` (text, nullable) — instructions for the employee
     performing the oil change (e.g. which engine, oil type, special steps).
     Null when oil change is not needed.

## Security
- No RLS policy changes. The existing yacht_bookings RLS policies already
  govern read/write access; the new column is covered by those same policies
  since RLS is table-level, not column-level.
- No data is lost: the column is nullable with no default, so existing rows
  simply have NULL until edited.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_bookings'
      AND column_name = 'oil_change_notes'
  ) THEN
    ALTER TABLE yacht_bookings ADD COLUMN oil_change_notes text;
  END IF;
END $$;