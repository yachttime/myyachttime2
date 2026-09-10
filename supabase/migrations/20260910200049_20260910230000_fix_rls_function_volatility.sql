/*
# Fix Slow Antelope Point Loading - Mark RLS Helper Functions STABLE

## Root Cause
get_user_company_id() is marked VOLATILE (PostgreSQL default). This means
PostgreSQL re-executes it for EVERY ROW in EVERY table when evaluating RLS
policies. 153 RLS policies call this function.

For AZ Marine (which has data), rows match early so scans are fast.
For Antelope Point (which has no data in most tables), the database scans
every single row in every table before returning empty results, causing
20+ second load times.

## Fix
Mark these functions STABLE so PostgreSQL evaluates them once per query
and caches the result. This is safe because:
- auth.uid() is STABLE (same value within a query)
- user_profiles data does not change mid-query
- The functions only read from user_profiles using auth.uid()

Also mark is_master() and is_staff(user_uuid) STABLE for the same reason.

## Additional: composite index on estimates
The Estimates loadData() query filters by company_id, archived, and status.
A composite index makes this query use an index-only scan.
*/

-- 1. Recreate get_user_company_id() as STABLE
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT COALESCE(
  (SELECT selected_company_id FROM user_profiles WHERE user_id = auth.uid() AND role = 'master' AND selected_company_id IS NOT NULL LIMIT 1),
  (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
);
$function$;

-- 2. Recreate is_master() as STABLE
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
RETURN EXISTS (
  SELECT 1
  FROM user_profiles
  WHERE user_id = auth.uid()
  AND role = 'master'
);
END;
$function$;

-- 3. Recreate is_staff(user_uuid uuid) as STABLE
CREATE OR REPLACE FUNCTION public.is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
RETURN EXISTS (
  SELECT 1
  FROM user_profiles
  WHERE user_id = user_uuid
  AND role IN ('staff', 'manager', 'mechanic', 'master')
  AND is_active = true
);
END;
$function$;

-- 4. Add composite index on estimates for the loadData query pattern
-- Query: WHERE company_id = ? AND archived = false AND status != 'converted'
CREATE INDEX IF NOT EXISTS idx_estimates_company_archived_status
ON estimates (company_id, archived, status);
