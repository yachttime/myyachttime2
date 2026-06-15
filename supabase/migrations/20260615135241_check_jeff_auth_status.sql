
-- Check Jeff's auth status
DO $$
DECLARE
  r record;
BEGIN
  SELECT id, email, email_confirmed_at, banned_until, deleted_at, last_sign_in_at
  INTO r
  FROM auth.users WHERE email = 'jeff@azmarine.net';
  
  RAISE NOTICE 'id=%, email=%, confirmed=%, banned=%, deleted=%, last_sign_in=%',
    r.id, r.email, r.email_confirmed_at, r.banned_until, r.deleted_at, r.last_sign_in_at;
END $$;
