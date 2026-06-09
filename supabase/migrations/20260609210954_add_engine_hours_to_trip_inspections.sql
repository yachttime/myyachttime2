-- Add dedicated numeric columns for engine/generator hours to trip_inspections.
-- Previously these were stored in repurposed text fields (cabin_notes, galley_notes,
-- head_notes, cabin_condition) which prevented those fields from being used for their
-- actual purpose.

ALTER TABLE trip_inspections
  ADD COLUMN IF NOT EXISTS port_engine_hours numeric(10, 1),
  ADD COLUMN IF NOT EXISTS stbd_engine_hours numeric(10, 1),
  ADD COLUMN IF NOT EXISTS port_gen_hours    numeric(10, 1),
  ADD COLUMN IF NOT EXISTS stbd_gen_hours    numeric(10, 1);

-- Backfill existing data from the repurposed fields.
-- Only migrate values that look numeric (trim whitespace, try casting).
UPDATE trip_inspections
SET
  port_engine_hours = CASE
    WHEN cabin_notes ~ '^[0-9]+(\.[0-9]+)?$' THEN cabin_notes::numeric(10,1)
    ELSE NULL
  END,
  stbd_engine_hours = CASE
    WHEN galley_notes ~ '^[0-9]+(\.[0-9]+)?$' THEN galley_notes::numeric(10,1)
    ELSE NULL
  END,
  port_gen_hours = CASE
    WHEN head_notes ~ '^[0-9]+(\.[0-9]+)?$' THEN head_notes::numeric(10,1)
    ELSE NULL
  END,
  stbd_gen_hours = CASE
    WHEN cabin_condition ~ '^[0-9]+(\.[0-9]+)?$' THEN cabin_condition::numeric(10,1)
    ELSE NULL
  END
WHERE
  cabin_notes ~ '^[0-9]+(\.[0-9]+)?$'
  OR galley_notes ~ '^[0-9]+(\.[0-9]+)?$'
  OR head_notes ~ '^[0-9]+(\.[0-9]+)?$'
  OR cabin_condition ~ '^[0-9]+(\.[0-9]+)?$';

-- Clear the repurposed fields so they are available for their actual purpose.
UPDATE trip_inspections
SET
  cabin_notes    = CASE WHEN cabin_notes    ~ '^[0-9]+(\.[0-9]+)?$' THEN '' ELSE cabin_notes    END,
  galley_notes   = CASE WHEN galley_notes   ~ '^[0-9]+(\.[0-9]+)?$' THEN '' ELSE galley_notes   END,
  head_notes     = CASE WHEN head_notes     ~ '^[0-9]+(\.[0-9]+)?$' THEN '' ELSE head_notes     END,
  cabin_condition = CASE WHEN cabin_condition ~ '^[0-9]+(\.[0-9]+)?$' THEN '' ELSE cabin_condition END
WHERE
  cabin_notes ~ '^[0-9]+(\.[0-9]+)?$'
  OR galley_notes ~ '^[0-9]+(\.[0-9]+)?$'
  OR head_notes ~ '^[0-9]+(\.[0-9]+)?$'
  OR cabin_condition ~ '^[0-9]+(\.[0-9]+)?$';

-- Index for fast per-yacht hour history queries
CREATE INDEX IF NOT EXISTS idx_trip_inspections_yacht_hours
  ON trip_inspections (yacht_id, created_at DESC)
  WHERE port_engine_hours IS NOT NULL
     OR stbd_engine_hours IS NOT NULL
     OR port_gen_hours IS NOT NULL
     OR stbd_gen_hours IS NOT NULL;
