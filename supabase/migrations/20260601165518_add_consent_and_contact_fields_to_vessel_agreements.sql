/*
  # Add Consent Checkboxes and Repair/Billing Approval Contacts to Vessel Agreements

  ## Summary
  When a manager signs a vessel management agreement via the public signing link,
  they need to:
  1. Check two consent boxes (Office Scheduling policy, Payment Terms policy)
  2. Provide contact info for the Management Team Repair Approval person
  3. Provide contact info for the Management Team Billing Approval person

  ## New Columns
  ### Consent fields (stored as booleans, set at time of signing)
  - `consent_office_scheduling` - acknowledged office scheduling policy
  - `consent_payment_terms` - acknowledged 48-hour payment terms

  ### Repair Approval contact (may differ from manager)
  - `repair_approval_name`
  - `repair_approval_email`
  - `repair_approval_phone`

  ### Billing Approval contact (may differ from manager)
  - `billing_approval_name`
  - `billing_approval_email`
  - `billing_approval_phone`

  ## Updated Function
  - sign_agreement_by_token now accepts all these extra parameters
  - Consent checkboxes are required (both must be true) to sign
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'consent_office_scheduling') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN consent_office_scheduling boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'consent_payment_terms') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN consent_payment_terms boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'repair_approval_name') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN repair_approval_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'repair_approval_email') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN repair_approval_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'repair_approval_phone') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN repair_approval_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'billing_approval_name') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN billing_approval_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'billing_approval_email') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN billing_approval_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vessel_management_agreements' AND column_name = 'billing_approval_phone') THEN
    ALTER TABLE vessel_management_agreements ADD COLUMN billing_approval_phone text;
  END IF;
END $$;

-- Update sign_agreement_by_token to accept and store consent + contacts
CREATE OR REPLACE FUNCTION sign_agreement_by_token(
  p_token uuid,
  p_signature_name text,
  p_consent_office_scheduling boolean DEFAULT false,
  p_consent_payment_terms boolean DEFAULT false,
  p_repair_approval_name text DEFAULT NULL,
  p_repair_approval_email text DEFAULT NULL,
  p_repair_approval_phone text DEFAULT NULL,
  p_billing_approval_name text DEFAULT NULL,
  p_billing_approval_email text DEFAULT NULL,
  p_billing_approval_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agreement vessel_management_agreements%ROWTYPE;
BEGIN
  SELECT * INTO v_agreement
  FROM vessel_management_agreements
  WHERE signing_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token', 'message', 'This signing link is invalid.');
  END IF;

  IF v_agreement.owner_signature_date IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_signed', 'message', 'This agreement has already been signed.');
  END IF;

  IF v_agreement.signing_token_created_at IS NULL OR
     v_agreement.signing_token_created_at < (now() - interval '30 days') THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired', 'message', 'This signing link has expired. Please contact AZ Marine for a new link.');
  END IF;

  IF p_signature_name IS NULL OR trim(p_signature_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Signature name is required.');
  END IF;

  IF NOT p_consent_office_scheduling THEN
    RETURN jsonb_build_object('success', false, 'error', 'consent_required', 'message', 'You must acknowledge the Office Scheduling policy.');
  END IF;

  IF NOT p_consent_payment_terms THEN
    RETURN jsonb_build_object('success', false, 'error', 'consent_required', 'message', 'You must acknowledge the Payment Terms policy.');
  END IF;

  IF p_repair_approval_name IS NULL OR trim(p_repair_approval_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Management Team Repair Approval name is required.');
  END IF;

  IF p_repair_approval_email IS NULL OR trim(p_repair_approval_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Management Team Repair Approval email is required.');
  END IF;

  IF p_repair_approval_phone IS NULL OR trim(p_repair_approval_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Management Team Repair Approval phone is required.');
  END IF;

  IF p_billing_approval_name IS NULL OR trim(p_billing_approval_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Management Team Billing Approval name is required.');
  END IF;

  IF p_billing_approval_email IS NULL OR trim(p_billing_approval_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Management Team Billing Approval email is required.');
  END IF;

  IF p_billing_approval_phone IS NULL OR trim(p_billing_approval_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'Management Team Billing Approval phone is required.');
  END IF;

  UPDATE vessel_management_agreements
  SET
    owner_signature_name = trim(p_signature_name),
    owner_signature_date = now(),
    owner_signature_ip = 'web-client',
    consent_office_scheduling = p_consent_office_scheduling,
    consent_payment_terms = p_consent_payment_terms,
    repair_approval_name = trim(p_repair_approval_name),
    repair_approval_email = trim(p_repair_approval_email),
    repair_approval_phone = trim(p_repair_approval_phone),
    billing_approval_name = trim(p_billing_approval_name),
    billing_approval_email = trim(p_billing_approval_email),
    billing_approval_phone = trim(p_billing_approval_phone)
  WHERE signing_token = p_token
    AND owner_signature_date IS NULL;

  RETURN jsonb_build_object('success', true, 'message', 'Agreement signed successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION sign_agreement_by_token(uuid, text, boolean, boolean, text, text, text, text, text, text) TO anon;
