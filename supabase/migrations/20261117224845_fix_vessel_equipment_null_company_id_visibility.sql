/*
# Fix invisible customer vessel engines and generators (missing company_id)

1. Problem
- Staff added engines/generators to customer boats, but the app showed nothing
  on the Customer Info page and in walk-in estimates — even though the data
  was saved.
- Cause: the viewing rules (Row Level Security) only show equipment rows whose
  `company_id` matches the signed-in user's company. Some saved equipment rows
  had no company_id at all (NULL), so no one could see them. This affected:
  - Engines added through "Edit Vessel" (the editor omitted company_id).
  - Equipment on older boats that were themselves saved without a company_id.

2. Data changes (non-destructive backfill)
- `customer_vessel_engines`: set company_id from the parent vessel where NULL.
- `customer_vessel_generators`: same.
- `customer_vessels`: for boats still missing company_id, inherit it from the
  boat's customer record (only fills NULLs; never overwrites a value).
- `customer_vessel_engines` / `customer_vessel_generators`: one final pass
  inheriting from the boat's customer directly, so no visible-data gaps remain.

3. Security changes
- Relaxed the SELECT policy on `customer_vessel_engines` and
  `customer_vessel_generators` to also allow rows whose company_id is NULL
  (`company_id = get_user_company_id() OR company_id IS NULL`), following the
  same pattern previously applied to `repair_requests`. This prevents future
  unlabeled rows from silently disappearing. INSERT/UPDATE/DELETE policies are
  unchanged.

4. Notes
- The app's vessel editor now also saves company_id with new engines, so new
  rows are labeled correctly at the source.
- All statements are idempotent and safe to re-run.
*/

-- Backfill equipment from the parent vessel
UPDATE customer_vessel_engines e
SET company_id = v.company_id
FROM customer_vessels v
WHERE e.vessel_id = v.id AND e.company_id IS NULL AND v.company_id IS NOT NULL;

UPDATE customer_vessel_generators g
SET company_id = v.company_id
FROM customer_vessels v
WHERE g.vessel_id = v.id AND g.company_id IS NULL AND v.company_id IS NOT NULL;

-- Backfill vessels still missing company_id from their customer record
UPDATE customer_vessels v
SET company_id = c.company_id
FROM customers c
WHERE v.customer_id = c.id AND v.company_id IS NULL AND c.company_id IS NOT NULL;

-- Final pass: any equipment still unlabeled inherits from the customer directly
UPDATE customer_vessel_engines e
SET company_id = c.company_id
FROM customer_vessels v
JOIN customers c ON c.id = v.customer_id
WHERE e.vessel_id = v.id AND e.company_id IS NULL AND c.company_id IS NOT NULL;

UPDATE customer_vessel_generators g
SET company_id = c.company_id
FROM customer_vessels v
JOIN customers c ON c.id = v.customer_id
WHERE g.vessel_id = v.id AND g.company_id IS NULL AND c.company_id IS NOT NULL;

-- Allow viewing unlabeled rows instead of hiding them
DROP POLICY IF EXISTS "Users can view company customer vessel engines" ON customer_vessel_engines;
CREATE POLICY "Users can view company customer vessel engines"
ON customer_vessel_engines FOR SELECT
TO authenticated
USING (company_id = get_user_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "Users can view company customer vessel generators" ON customer_vessel_generators;
CREATE POLICY "Users can view company customer vessel generators"
ON customer_vessel_generators FOR SELECT
TO authenticated
USING (company_id = get_user_company_id() OR company_id IS NULL);
