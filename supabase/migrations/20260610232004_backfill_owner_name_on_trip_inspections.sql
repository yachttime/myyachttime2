-- Backfill owner_name on all trip_inspections where owner_name is null
-- Match each inspection to the booking on the same yacht whose date range
-- most closely contains or precedes the inspection date.
UPDATE trip_inspections ti
SET owner_name = matched.owner_name
FROM (
  SELECT DISTINCT ON (ti2.id)
    ti2.id AS inspection_id,
    yb.owner_name
  FROM trip_inspections ti2
  JOIN yacht_bookings yb
    ON yb.yacht_id = ti2.yacht_id
    AND yb.owner_name IS NOT NULL
    AND yb.owner_name <> ''
  WHERE ti2.owner_name IS NULL
  ORDER BY
    ti2.id,
    -- Prefer bookings that overlap the inspection date (start <= inspection <= end)
    CASE WHEN yb.start_date <= ti2.created_at AND yb.end_date >= ti2.created_at THEN 0 ELSE 1 END,
    -- Among non-overlapping, prefer the booking whose end_date is closest before the inspection
    ABS(EXTRACT(EPOCH FROM (yb.end_date - ti2.created_at)))
) matched
WHERE ti.id = matched.inspection_id;
