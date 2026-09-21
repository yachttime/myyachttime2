/*
# Backfill company_id on estimate_package_labor and estimate_package_parts

## Problem
When service packages (like "200 Hour Service") were created, the child rows in
estimate_package_labor and estimate_package_parts were inserted without a company_id.
After company isolation RLS policies were added (policy: company_id = get_user_company_id()),
these child rows became invisible to staff users because NULL != the user's company_id.
Symptom: when adding the "200 Hour Service" package to an estimate, only the header row
appears — no labor or parts lines are included.

## Fix
Backfill company_id on all estimate_package_labor and estimate_package_parts rows that
have a NULL company_id by inheriting the company_id from their parent estimate_packages row.
This makes the rows visible to the correct company's users again.

## Tables affected
- estimate_package_labor (13 rows with NULL company_id)
- estimate_package_parts (65 rows with NULL company_id)

## Security
No policy changes — existing RLS policies remain in place. This purely fixes data so
existing policies work correctly.

## Notes
1. Rows whose parent package also has a NULL company_id are left as-is (those are
   master-created packages that bypass company isolation).
2. Safe to re-run — only updates rows where company_id IS NULL.
*/

UPDATE estimate_package_labor AS epl
SET company_id = ep.company_id
FROM estimate_packages AS ep
WHERE epl.package_id = ep.id
  AND epl.company_id IS NULL
  AND ep.company_id IS NOT NULL;

UPDATE estimate_package_parts AS epp
SET company_id = ep.company_id
FROM estimate_packages AS ep
WHERE epp.package_id = ep.id
  AND epp.company_id IS NULL
  AND ep.company_id IS NOT NULL;
