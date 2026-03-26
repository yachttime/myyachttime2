/*
  # Create update_user_password function

  Allows the edge function (via service role) to directly update a user's
  encrypted password in auth.users, bypassing HaveIBeenPwned checks so
  master users can set any temporary password they choose.
*/

CREATE OR REPLACE FUNCTION update_user_password(p_user_id uuid, p_encrypted_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = p_encrypted_password,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION update_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_user_password(uuid, text) TO service_role;
