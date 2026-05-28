/*
  # Backfill Inspection Hours for Existing Trip Inspections

  ## Purpose
  Before the inspection_time_entries system was created, 6 trip inspections
  were completed (May 26-27, 2026) without inspection hours being logged.
  This migration credits 2.0 hours to each inspector for those inspections.

  ## Inspections Covered (all trip_inspection type)
  - UTOPIA - Joshua Buckley - 2026-05-27
  - RHAPSODY - Joshua Buckley - 2026-05-27 (2 inspections)
  - DESTINY - Bo Cole - 2026-05-26
  - LEGACY - Bo Cole - 2026-05-26
  - ELATION - Joshua Buckley - 2026-05-26

  ## Safety
  Uses INSERT ... WHERE NOT EXISTS to prevent duplicate entries if run more than once.
*/

INSERT INTO inspection_time_entries (user_id, yacht_id, inspection_id, inspection_type, hours, inspection_date, company_id)
SELECT
  ti.inspector_id,
  ti.yacht_id,
  ti.id,
  'trip_inspection',
  2.0,
  ti.created_at,
  ti.company_id
FROM trip_inspections ti
WHERE ti.inspector_id IS NOT NULL
  AND ti.created_at >= '2026-05-26'
  AND NOT EXISTS (
    SELECT 1 FROM inspection_time_entries ite
    WHERE ite.inspection_id = ti.id
      AND ite.inspection_type = 'trip_inspection'
  );
