/*
# Add sort_order to salvage_report_media

1. Changes
- Adds `sort_order` (integer, default 0) to `salvage_report_media` so photos/videos within a report can be reordered.
- Backfills existing rows with an incrementing order per report based on created_at.

2. Security
- No RLS changes. Existing policies still govern access.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salvage_report_media' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE salvage_report_media ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill: assign sequential sort_order per report grouped by media_type, ordered by created_at
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY salvage_report_id, media_type
           ORDER BY created_at
         ) - 1 AS rn
  FROM salvage_report_media
)
UPDATE salvage_report_media m
SET sort_order = ranked.rn
FROM ranked
WHERE m.id = ranked.id AND m.sort_order = 0;
