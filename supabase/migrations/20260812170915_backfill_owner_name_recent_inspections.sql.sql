-- Backfill owner_name on trip_inspections where owner_name is null
-- Match each inspection to the booking on the same yacht whose date range
-- most closely contains or precedes the inspection date.
-- Also resolve owner names from user_profiles when booking.owner_name is empty.
UPDATE trip_inspections ti
SET owner_name = matched.owner_name
FROM (
  SELECT DISTINCT ON (ti2.id)
    ti2.id AS inspection_id,
    COALESCE(
      yb.owner_name,
      CASE
        WHEN yb.user_id IS NOT NULL AND up.first_name IS NOT NULL
          THEN NULLIF(TRIM(up.first_name || ' ' || COALESCE(up.last_name, '')), '')
        ELSE NULL
      END
    ) AS owner_name
  FROM trip_inspections ti2
  JOIN yacht_bookings yb
    ON yb.yacht_id = ti2.yacht_id
  LEFT JOIN user_profiles up
    ON up.user_id = yb.user_id
  WHERE ti2.owner_name IS NULL
    AND COALESCE(yb.owner_name, '') <> ''
    OR (yb.user_id IS NOT NULL AND up.first_name IS NOT NULL)
  ORDER BY
    ti2.id,
    -- Prefer bookings that overlap the inspection date (start <= inspection <= end)
    CASE WHEN yb.start_date <= ti2.created_at AND yb.end_date >= ti2.created_at THEN 0 ELSE 1 END,
    -- Among non-overlapping, prefer the booking whose end_date is closest before the inspection
    ABS(EXTRACT(EPOCH FROM (yb.end_date - ti2.created_at)))
) matched
WHERE ti.id = matched.inspection_id
  AND matched.owner_name IS NOT NULL;
