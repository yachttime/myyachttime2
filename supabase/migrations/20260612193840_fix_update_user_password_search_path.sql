DROP FUNCTION IF EXISTS update_user_password(uuid, text);

CREATE FUNCTION update_user_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION update_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_user_password(uuid, text) TO service_role;