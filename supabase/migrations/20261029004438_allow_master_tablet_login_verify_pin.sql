CREATE OR REPLACE FUNCTION verify_tablet_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company uuid;
  v_locked_until timestamptz;
  v_staff_id uuid;
  v_staff_first text;
  v_staff_last text;
  v_staff_role text;
  v_failed int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT company_id INTO v_company
  FROM user_profiles
  WHERE user_id = v_uid AND role IN ('tablet', 'master') AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a tablet login';
  END IF;

  SELECT locked_until INTO v_locked_until FROM tablet_unlock_attempts WHERE user_id = v_uid;
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_locked_until);
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT up.user_id, up.first_name, up.last_name, up.role::text
    INTO v_staff_id, v_staff_first, v_staff_last, v_staff_role
  FROM staff_tablet_pins p
  JOIN user_profiles up ON up.user_id = p.user_id
  WHERE p.company_id = v_company
    AND up.is_active
    AND up.role IN ('staff', 'master')
    AND extensions.crypt(p_pin, p.pin_hash) = p.pin_hash
  LIMIT 1;

  IF v_staff_id IS NOT NULL THEN
    INSERT INTO tablet_unlock_attempts (user_id, failed_attempts, locked_until)
    VALUES (v_uid, 0, NULL)
    ON CONFLICT (user_id) DO UPDATE SET failed_attempts = 0, locked_until = NULL;

    RETURN jsonb_build_object(
      'status', 'unlocked',
      'name', trim(coalesce(v_staff_first, '') || ' ' || coalesce(v_staff_last, '')),
      'role', v_staff_role
    );
  END IF;

  INSERT INTO tablet_unlock_attempts (user_id, failed_attempts, locked_until)
  VALUES (v_uid, 1, NULL)
  ON CONFLICT (user_id) DO UPDATE SET
    failed_attempts = tablet_unlock_attempts.failed_attempts + 1,
    locked_until = CASE
      WHEN tablet_unlock_attempts.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
      ELSE NULL
    END
  RETURNING failed_attempts, locked_until INTO v_failed, v_locked_until;

  IF v_failed >= 5 THEN
    UPDATE tablet_unlock_attempts SET failed_attempts = 0 WHERE user_id = v_uid;
    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_locked_until);
  END IF;

  RETURN jsonb_build_object('status', 'wrong');
END;
$$;

REVOKE ALL ON FUNCTION verify_tablet_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_tablet_pin(text) TO authenticated;
