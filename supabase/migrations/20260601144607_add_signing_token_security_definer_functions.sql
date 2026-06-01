/*
  # Fix Public Signing RLS - Use SECURITY DEFINER Functions Instead

  ## Summary
  The JWT claims approach for anon RLS is unreliable for URL-param based tokens.
  This migration:
  1. Drops the JWT-claims-based policies added in the previous migration
  2. Creates two SECURITY DEFINER functions that can be called by the anon role:
     - get_agreement_by_signing_token: reads agreement safely by token
     - sign_agreement_by_token: writes only the signature fields when token is valid

  ## Security Model
  - SECURITY DEFINER means the function runs as the DB owner (bypasses RLS)
  - Functions validate the token, expiry, and "not already signed" before acting
  - The anon role has EXECUTE permission on these functions only
  - No direct table access is granted to anon for updates
*/

-- Drop the JWT claims policies (they won't work reliably for URL-param tokens)
DROP POLICY IF EXISTS "Public can view agreement by signing token" ON vessel_management_agreements;
DROP POLICY IF EXISTS "Public can sign agreement with valid token" ON vessel_management_agreements;

-- Function to read an agreement by its signing token (anon-safe, read-only)
CREATE OR REPLACE FUNCTION get_agreement_by_signing_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  yacht_id uuid,
  season_name text,
  status text,
  manager_name text,
  manager_email text,
  manager_phone text,
  manager_address text,
  manager_city text,
  manager_state text,
  manager_zip text,
  manager_billing_approval_name text,
  manager_billing_approval_email text,
  manager_billing_approval_phone text,
  annual_fee numeric,
  trip_fee numeric,
  extended_trip_fee numeric,
  charter_percentage numeric,
  management_fee_percentage numeric,
  special_terms text,
  agreement_start_date date,
  agreement_end_date date,
  arrival_time time,
  departure_time time,
  owner_signature_name text,
  owner_signature_date timestamptz,
  staff_signature_name text,
  staff_signature_date timestamptz,
  signing_token uuid,
  signing_token_created_at timestamptz,
  signing_email_sent_at timestamptz,
  signing_email_delivered_at timestamptz,
  signing_email_opened_at timestamptz,
  signing_email_clicked_at timestamptz,
  signing_email_bounced_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.yacht_id,
    a.season_name,
    a.status::text,
    a.manager_name,
    a.manager_email,
    a.manager_phone,
    a.manager_address,
    a.manager_city,
    a.manager_state,
    a.manager_zip,
    a.manager_billing_approval_name,
    a.manager_billing_approval_email,
    a.manager_billing_approval_phone,
    a.annual_fee,
    a.trip_fee,
    a.extended_trip_fee,
    a.charter_percentage,
    a.management_fee_percentage,
    a.special_terms,
    a.agreement_start_date,
    a.agreement_end_date,
    a.arrival_time,
    a.departure_time,
    a.owner_signature_name,
    a.owner_signature_date,
    a.staff_signature_name,
    a.staff_signature_date,
    a.signing_token,
    a.signing_token_created_at,
    a.signing_email_sent_at,
    a.signing_email_delivered_at,
    a.signing_email_opened_at,
    a.signing_email_clicked_at,
    a.signing_email_bounced_at
  FROM vessel_management_agreements a
  WHERE a.signing_token = p_token
  LIMIT 1;
END;
$$;

-- Function to sign an agreement by token (validates expiry + not-already-signed)
CREATE OR REPLACE FUNCTION sign_agreement_by_token(
  p_token uuid,
  p_signature_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agreement vessel_management_agreements%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Look up the agreement
  SELECT * INTO v_agreement
  FROM vessel_management_agreements
  WHERE signing_token = p_token
  LIMIT 1;

  -- Token not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token', 'message', 'This signing link is invalid.');
  END IF;

  -- Already signed
  IF v_agreement.owner_signature_date IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_signed', 'message', 'This agreement has already been signed.');
  END IF;

  -- Token expired (30 days)
  IF v_agreement.signing_token_created_at IS NULL OR
     v_agreement.signing_token_created_at < (now() - interval '30 days') THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired', 'message', 'This signing link has expired. Please contact AZ Marine for a new link.');
  END IF;

  -- Validate signature name
  IF p_signature_name IS NULL OR trim(p_signature_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Signature name is required.');
  END IF;

  -- Apply the signature
  UPDATE vessel_management_agreements
  SET
    owner_signature_name = trim(p_signature_name),
    owner_signature_date = now(),
    owner_signature_ip = 'web-client'
  WHERE signing_token = p_token
    AND owner_signature_date IS NULL;

  RETURN jsonb_build_object('success', true, 'message', 'Agreement signed successfully.');
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION get_agreement_by_signing_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION sign_agreement_by_token(uuid, text) TO anon;
