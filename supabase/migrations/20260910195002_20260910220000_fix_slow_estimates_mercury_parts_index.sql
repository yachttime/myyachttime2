/*
# Fix Slow Estimates Loading - Mercury Parts Index + Company Backfill

## Problem
The Estimates screen takes 20+ seconds to load because it runs a count query on
mercury_marine_parts (313,488 rows) filtered by is_active=true. All rows have
company_id=NULL, so the RLS policy `company_id = get_user_company_id()` rejects
every row, but Postgres still scans all 313K rows to determine zero matches.
There's no composite index on (company_id, is_active) so the scan is slow.

## Changes

### 1. Add composite index on mercury_marine_parts (company_id, is_active)
This allows the count query to use an index-only scan instead of a full table scan.

### 2. Backfill mercury_marine_parts company_id to AZ Marine
All 313K mercury parts have company_id=NULL. They should belong to AZ Marine
(company_id = 519b4394-d35c-46d7-997c-db7e46178ef5) so they're visible to AZ Marine
users and invisible to Antelope Point users (which is the correct behavior).

## Security
No RLS policy changes. The index improves performance. The backfill assigns data
to the correct company so RLS filtering works properly.
*/

-- Add composite index for the count query pattern: WHERE is_active = true AND company_id = get_user_company_id()
CREATE INDEX IF NOT EXISTS idx_mercury_parts_company_active 
ON mercury_marine_parts (company_id, is_active);

-- Backfill all NULL company_id mercury parts to AZ Marine
UPDATE mercury_marine_parts 
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5' 
WHERE company_id IS NULL;
