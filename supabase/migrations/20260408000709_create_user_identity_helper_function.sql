/*
  # Create user identity helper function

  Creates a secure RPC function that inserts a missing auth.identities record
  for a user. This is used as a fallback when the edge function cannot insert
  directly into auth.identities via the Supabase client.

  Used by the create-user edge function to ensure every new user has the
  required identity record for email/password login.
*/

CREATE OR REPLACE FUNCTION create_user_identity(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    p_user_id,
    p_user_id,
    p_email,
    jsonb_build_object(
      'sub', p_user_id::text,
      'email', p_email,
      'email_verified', true,
      'provider', 'email'
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION create_user_identity(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_user_identity(uuid, text) TO service_role;
