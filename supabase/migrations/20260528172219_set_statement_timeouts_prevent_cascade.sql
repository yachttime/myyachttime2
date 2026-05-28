/*
  # Set statement timeouts to prevent query cascade failures

  ## Problem
  statement_timeout is currently 0 (disabled) — queries can run indefinitely.
  When Supabase has any slowdown, queries pile up and exhaust the connection
  pool, causing 504/57014 errors across auth, REST, and all other endpoints.

  ## Changes
  - Set 8 second timeout for the `authenticator` role (PostgREST / API calls)
  - Set 8 second timeout for the `anon` role (unauthenticated requests)
  - Set 8 second timeout for the `authenticated` role (logged-in user requests)
  - Leave `postgres` / `supabase_admin` unrestricted for migrations and admin work

  These values match Supabase's own recommended settings for production projects.
*/

ALTER ROLE authenticator SET statement_timeout = '8s';
ALTER ROLE anon SET statement_timeout = '8s';
ALTER ROLE authenticated SET statement_timeout = '8s';
