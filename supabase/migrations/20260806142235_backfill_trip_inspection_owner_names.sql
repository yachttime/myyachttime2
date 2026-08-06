/*
# Backfill owner_name on trip inspections

## Purpose
124 of 159 trip inspections have a null owner_name. This migration fills in the
owner name by matching each inspection to the yacht booking whose trip dates
overlap the inspection date. The booking's owner_name is used, or if the booking
has additional owners in yacht_booking_owners, those names are joined.

## How it works
1. For each inspection with null owner_name and a non-null yacht_id:
   - Find the booking on that yacht where the inspection date falls within
     start_date (minus 1 day) through end_date (plus 1 day).
   - Prefer the booking whose end_date is closest to the inspection date
     (the trip that was ending around when the inspection happened).
   - If the booking has rows in yacht_booking_owners, join all owner names
     with commas. Otherwise use the booking's owner_name directly.
   - If the booking's owner_name is null but it has a user_id, fall back to
     the user_profiles first_name + last_name.
2. Update the trip_inspections row with the derived owner_name.

## Safety
- Only updates rows where owner_name IS NULL (does not overwrite existing values).
- No schema changes, no RLS changes, no destructive operations.
- Idempotent: re-running has no effect because all matching rows will already
  have owner_name populated.
*/

UPDATE trip_inspections ti
SET owner_name = derived.owner_name
FROM (
  SELECT
    ti.id AS inspection_id,
    COALESCE(
      (
        SELECT string_agg(ybo.owner_name, ', ')
        FROM yacht_booking_owners ybo
        WHERE ybo.booking_id = best_booking.id
          AND ybo.owner_name IS NOT NULL
      ),
      best_booking.owner_name,
      best_booking.user_name
    ) AS owner_name
  FROM trip_inspections ti
  JOIN LATERAL (
    SELECT
      yb.id,
      yb.owner_name,
      up.first_name || ' ' || up.last_name AS user_name
    FROM yacht_bookings yb
    LEFT JOIN user_profiles up ON up.user_id = yb.user_id
    WHERE yb.yacht_id = ti.yacht_id
      AND yb.start_date::date <= (ti.inspection_date::date + interval '1 day')::date
      AND yb.end_date::date >= (ti.inspection_date::date - interval '1 day')::date
    ORDER BY ABS(yb.end_date::date - ti.inspection_date::date)
    LIMIT 1
  ) AS best_booking ON true
  WHERE ti.owner_name IS NULL
    AND ti.yacht_id IS NOT NULL
) AS derived
WHERE ti.id = derived.inspection_id
  AND derived.owner_name IS NOT NULL
  AND derived.owner_name <> ''
  AND ti.owner_name IS NULL;