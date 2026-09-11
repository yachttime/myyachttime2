/*
# Fix estimate number generation race condition

1. Overview
- Replace the estimate number generator's `MAX(...) + 1` logic with a PostgreSQL sequence.
- The existing logic can return the same number to two simultaneous saves, causing a unique-constraint error.

2. Database Objects
- Add `estimate_number_seq` when it does not already exist.
- Initialize the sequence from the highest existing numeric estimate number.
- Update `generate_estimate_number()` to use `nextval()` so each request receives a unique number atomically.

3. Security
- Keep the existing authenticated application behavior.
- Run the generator as a restricted SECURITY DEFINER function so it can allocate numbers consistently across company-filtered rows without exposing table access.
- Set a fixed search path for safe name resolution.

4. Data Safety
- No existing estimates are changed or deleted.
- Existing estimate numbers remain valid and the next number starts after the current highest value.
*/

CREATE SEQUENCE IF NOT EXISTS public.estimate_number_seq;

SELECT setval(
  'public.estimate_number_seq'::regclass,
  COALESCE(
    (
      SELECT MAX(SUBSTRING(estimate_number FROM 4)::integer)
      FROM public.estimates
      WHERE estimate_number ~ '^EST[0-9]+$'
    ),
    0
  ),
  true
);

CREATE OR REPLACE FUNCTION public.generate_estimate_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
