
-- Get Jeff's user ID and reset password using the proper function
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jeff@azmarine.net';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User jeff@azmarine.net not found';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt('AZMarine2026!', extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = v_user_id;

  RAISE NOTICE 'Password reset for user %', v_user_id;
END $$;
