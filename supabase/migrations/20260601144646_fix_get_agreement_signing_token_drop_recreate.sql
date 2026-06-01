/*
  # Fix get_agreement_by_signing_token - Drop and Recreate with Correct Columns
*/

DROP FUNCTION IF EXISTS get_agreement_by_signing_token(uuid);

CREATE FUNCTION get_agreement_by_signing_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  yacht_id uuid,
  season_name text,
  season_year integer,
  status text,
  vessel_name text,
  vessel_make_model text,
  vessel_year integer,
  vessel_length text,
  vessel_hull_number text,
  manager_name text,
  manager_email text,
  manager_phone text,
  manager_address text,
  manager_billing_approval_name text,
  manager_billing_approval_email text,
  manager_billing_approval_phone text,
  manager_repair_approval_name text,
  manager_repair_approval_email text,
  manager_repair_approval_phone text,
  annual_fee numeric,
  per_trip_fee numeric,
  total_trip_cost numeric,
  grand_total numeric,
  season_trips integer,
  off_season_trips integer,
  management_scope text,
  maintenance_plan text,
  usage_restrictions text,
  financial_terms text,
  special_provisions text,
  additional_services text,
  consent_office_scheduling boolean,
  consent_payment_terms boolean,
  start_date date,
  end_date date,
  agreed_arrival_time time,
  agreed_departure_time time,
  contract_date date,
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
  signing_email_bounced_at timestamptz,
  created_at timestamptz
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
    a.season_year,
    a.status,
    a.vessel_name,
    a.vessel_make_model,
    a.vessel_year,
    a.vessel_length,
    a.vessel_hull_number,
    a.manager_name,
    a.manager_email,
    a.manager_phone,
    a.manager_address,
    a.manager_billing_approval_name,
    a.manager_billing_approval_email,
    a.manager_billing_approval_phone,
    a.manager_repair_approval_name,
    a.manager_repair_approval_email,
    a.manager_repair_approval_phone,
    a.annual_fee,
    a.per_trip_fee,
    a.total_trip_cost,
    a.grand_total,
    a.season_trips,
    a.off_season_trips,
    a.management_scope,
    a.maintenance_plan,
    a.usage_restrictions,
    a.financial_terms,
    a.special_provisions,
    a.additional_services,
    a.consent_office_scheduling,
    a.consent_payment_terms,
    a.start_date,
    a.end_date,
    a.agreed_arrival_time,
    a.agreed_departure_time,
    a.contract_date,
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
    a.signing_email_bounced_at,
    a.created_at
  FROM vessel_management_agreements a
  WHERE a.signing_token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agreement_by_signing_token(uuid) TO anon;
