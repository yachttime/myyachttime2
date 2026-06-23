-- Increase statement timeout for authenticator role to prevent schema cache failures
-- The PostgREST schema cache query can take longer than 8s during Supabase load spikes
ALTER ROLE authenticator SET statement_timeout = '30s';
ALTER ROLE anon SET statement_timeout = '30s';
ALTER ROLE authenticated SET statement_timeout = '30s';

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
