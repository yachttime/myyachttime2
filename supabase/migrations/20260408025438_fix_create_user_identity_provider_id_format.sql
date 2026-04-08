
/*
  # Fix create_user_identity function to use UUID as provider_id

  ## Problem
  The create_user_identity function was using the user's email as provider_id,
  but Supabase requires the user UUID as provider_id for email provider identities.
  This caused "Database error querying schema" on login for affected users.

  ## Fix
  Update the function to use p_user_id (UUID) as provider_id instead of p_email,
  and match the correct identity_data format Supabase expects (with phone_verified field).
*/

CREATE OR REPLACE FUNCTION public.create_user_identity(p_user_id uuid, p_email text)
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
    p_user_id::text,
    jsonb_build_object(
      'sub', p_user_id::text,
      'email', p_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;
END;
$$;
