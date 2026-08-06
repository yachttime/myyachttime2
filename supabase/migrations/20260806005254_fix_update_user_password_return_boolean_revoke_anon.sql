/*
  # Make update_user_password return whether a row was updated

  Changes the function's return type from void to boolean so the
  reset-user-password edge function can verify the password was
  actually changed (row found and updated) instead of silently
  succeeding when the target user_id does not exist in auth.users.

  Also revokes execute from anon and authenticated — only the
  service_role should call this function.
*/

DROP FUNCTION IF EXISTS update_user_password(uuid, text);

CREATE FUNCTION update_user_password(p_user_id uuid, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION update_user_password(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_user_password(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_password(uuid, text) TO service_role;