/*
# Fix Engine Catalog Visibility for AZ Marine

## Problem
The Engine & Generator Database card appears empty for AZ Marine users because:
1. All 10 existing engine_catalog entries have `company_id = NULL`
2. The SELECT RLS policy (changed by company-isolation migration) requires
   `company_id = get_user_company_id()`, which excludes NULL company_id rows

## Fix
1. Update the SELECT policy to also allow rows where `company_id IS NULL`
   (shared/global catalog entries), so existing entries are visible again.
2. Backfill all existing NULL company_id entries to AZ Marine's company_id,
   so they are properly owned and visible through company isolation.

## Security
- SELECT policy: users can view entries matching their company OR shared
  entries with NULL company_id
- INSERT/UPDATE/DELETE policies remain unchanged (staff-only via is_staff())
*/

-- Fix SELECT policy to include shared (NULL company_id) entries
DROP POLICY IF EXISTS "Users can view company engine catalog" ON engine_catalog;
DROP POLICY IF EXISTS "select_engine_catalog" ON engine_catalog;
CREATE POLICY "Users can view company engine catalog"
  ON engine_catalog FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_user_company_id());

-- Backfill existing entries to AZ Marine's company_id
UPDATE engine_catalog
SET company_id = (
  SELECT id FROM companies WHERE company_name = 'AZ Marine' LIMIT 1
)
WHERE company_id IS NULL;