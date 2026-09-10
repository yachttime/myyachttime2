/*
# Fix get_user_company_id() Inlining Bug - Convert SQL to PL/pgSQL

## Root Cause
get_user_company_id() was a SQL language STABLE function. PostgreSQL inlines
SQL language STABLE functions, which can cause auth.uid() (which reads session
variables via current_setting()) to be evaluated at plan time instead of
runtime, returning NULL. This breaks all 153 RLS policies that depend on it,
making all data invisible.

## Fix
Recreate the function in PL/pgSQL language. PL/pgSQL STABLE functions are
NOT inlined by the planner, so auth.uid() is always evaluated at runtime
within each transaction. The STABLE volatility is preserved so PostgreSQL
still caches the result within a single query (the performance fix from
the previous migration).

## Why PL/pgSQL is safe here
- PL/pgSQL functions are never inlined into query plans
- STABLE means the result is cached within a single query call
- auth.uid() is STABLE within a transaction (reads from JWT claims)
- user_profiles data doesn't change mid-query
*/

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result uuid;
BEGIN
  SELECT COALESCE(
    (SELECT selected_company_id FROM user_profiles WHERE user_id = auth.uid() AND role = 'master' AND selected_company_id IS NOT NULL LIMIT 1),
    (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  ) INTO result;
  RETURN result;
END;
$function$;
