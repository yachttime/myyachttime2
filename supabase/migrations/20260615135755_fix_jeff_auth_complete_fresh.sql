
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jeff@azmarine.net';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User jeff@azmarine.net not found';
  END IF;

  UPDATE auth.users SET 
    encrypted_password = extensions.crypt('AZMarine2026!', extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    deleted_at = NULL,
    is_sso_user = false,
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE auth.identities SET 
    identity_data = jsonb_build_object(
      'sub', v_user_id::text,
      'email', 'jeff@azmarine.net',
      'email_verified', true
    ),
    updated_at = now()
  WHERE user_id = v_user_id AND provider = 'email';

  RAISE NOTICE 'Jeff auth reset complete for user_id: %', v_user_id;
END $$;
