/*
# Publish yacht_bookings to realtime

1. Modified Tables
- `yacht_bookings` is added to the `supabase_realtime` publication so the master calendar receives live updates when an owner checks in or out on the tablet.

2. Security
- No change to row level security or grants. Realtime still respects existing policies.

3. Notes
- Idempotent: the table is only added when it is not already published.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'yacht_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.yacht_bookings;
  END IF;
END $$;
