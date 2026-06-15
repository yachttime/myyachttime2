
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jeff@azmarine.net';
  
  -- Reset password and confirm email
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt('AZMarine2026!', extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    deleted_at = NULL,
    updated_at = now()
  WHERE id = v_user_id;

  -- Update existing identity to ensure email_verified = true
  UPDATE auth.identities
  SET 
    identity_data = identity_data || jsonb_build_object('email_verified', true),
    updated_at = now()
  WHERE user_id = v_user_id AND provider = 'email';

  RAISE NOTICE 'Done for user_id=%', v_user_id;
END $$;
