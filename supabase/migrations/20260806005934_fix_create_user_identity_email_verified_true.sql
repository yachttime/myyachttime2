/*
  # Fix create_user_identity to set email_verified=true

  The create-user edge function always creates users with email_confirm: true,
  but the create_user_identity helper was hardcoding email_verified to false
  in the identity_data JSON. Working users (who can log in) have
  email_verified: true. This fix updates the function for future users
  and repairs existing broken identity records.

  1. Update create_user_identity to set email_verified: true
  2. Fix existing identity records that have email_verified: false
     but whose auth.users record has email_confirmed_at set
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
      'email_verified', true,
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

-- Fix existing identity records: set email_verified to true where email_confirmed_at is set
UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email_verified}', 'true'::jsonb),
    updated_at = now()
WHERE provider = 'email'
  AND (identity_data->>'email_verified') = 'false'
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.identities.user_id
      AND u.email_confirmed_at IS NOT NULL
  );