/*
  # Fix truncate_mercury_marine_parts function to use CASCADE

  ## Problem
  The existing truncate function fails with FK constraint error because
  `estimate_line_items` has a foreign key referencing `mercury_marine_parts`.

  ## Fix
  Use TRUNCATE ... CASCADE to automatically handle dependent tables.

  ## Note
  CASCADE will also clear any rows in `estimate_line_items` that reference
  mercury parts. This is acceptable since we're replacing all parts data.
*/

CREATE OR REPLACE FUNCTION truncate_mercury_marine_parts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE mercury_marine_parts CASCADE;
END;
$$;

GRANT EXECUTE ON FUNCTION truncate_mercury_marine_parts() TO authenticated;
