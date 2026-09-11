/*
# Fix estimate number generator transaction mode

1. Overview
- Correct the estimate number generator so PostgreSQL treats it as a write-capable function.
- The generator uses `nextval()` on the estimate number sequence, which must not be declared STABLE.

2. Modified Database Object
- Update `public.generate_estimate_number()` from STABLE to VOLATILE.
- Preserve the existing sequence-backed numbering behavior and formatting.
- Preserve SECURITY DEFINER and the fixed search path.

3. Security
- Keep execution limited to authenticated users.
- No table policies, user access rules, or estimate data are changed.

4. Data Safety
- No existing estimates are modified or deleted.
- The sequence remains the source of unique estimate numbers.
- A number may be skipped after a failed save, but duplicate numbers cannot be issued by concurrent requests.
*/

CREATE OR REPLACE FUNCTION public.generate_estimate_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  next_num integer;
BEGIN
  next_num := nextval('public.estimate_number_seq');
  RETURN 'EST' || LPAD(next_num::text, 6, '0');
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_estimate_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_estimate_number() TO authenticated;
