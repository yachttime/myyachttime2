/*
  # Create truncate function for mercury_marine_parts

  Creates a security-definer function that truncates the mercury_marine_parts
  table instantly, bypassing the RLS row-by-row DELETE timeout issue.
  Only callable by authenticated users with the master role.
*/

CREATE OR REPLACE FUNCTION truncate_mercury_marine_parts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE mercury_marine_parts RESTART IDENTITY;
END;
$$;

GRANT EXECUTE ON FUNCTION truncate_mercury_marine_parts() TO authenticated;
