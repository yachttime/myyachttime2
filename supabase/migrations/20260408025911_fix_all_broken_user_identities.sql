
/*
  # Fix all broken user identities

  ## Problem
  17 users have auth.identities records where provider_id was incorrectly set
  to the user's email address instead of their UUID. This causes a
  "Database error querying schema" error on login.

  ## Fix
  For each affected user:
  1. Delete the broken identity record (where provider_id = email)
  2. Insert a correct identity record (where provider_id = user_id UUID)

  This restores login ability for all 17 affected users.
*/

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, email
    FROM auth.identities
    WHERE provider = 'email'
      AND provider_id != user_id::text
  LOOP
    DELETE FROM auth.identities
    WHERE user_id = r.user_id
      AND provider = 'email'
      AND provider_id != r.user_id::text;

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      r.user_id,
      r.user_id,
      r.user_id::text,
      jsonb_build_object(
        'sub', r.user_id::text,
        'email', r.email,
        'email_verified', false,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END LOOP;
END $$;
