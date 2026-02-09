/*
  # Add SMS Consent Tracking for Twilio Compliance

  ## Overview
  Adds SMS consent (opt-in) tracking fields to user_profiles to comply with Twilio
  and TCPA (Telephone Consumer Protection Act) requirements.

  ## Changes to user_profiles Table
    - `sms_consent_given` (boolean, default false) - Whether user has opted in to SMS reminders
    - `sms_consent_date` (timestamptz, nullable) - When the user gave consent
    - `sms_consent_method` (text, nullable) - How consent was collected (e.g., 'web_form', 'written_form', 'verbal')
    - `sms_consent_ip_address` (text, nullable) - IP address when consent was given (audit trail)
    - `sms_consent_withdrawn_date` (timestamptz, nullable) - When user withdrew consent (if applicable)

  ## Consent Collection Methods
    - `web_form` - User opted in through the web application
    - `written_form` - User signed a written consent form
    - `verbal` - User gave verbal consent (documented)
    - `employee_onboarding` - Consent collected during employee onboarding process

  ## Compliance Notes
    - Users must explicitly opt-in before receiving any SMS messages
    - Consent must be documented with date, method, and audit trail
    - Users can withdraw consent at any time
    - Only users with sms_consent_given = true will receive SMS notifications
*/

-- Add SMS consent tracking fields to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sms_consent_given'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sms_consent_given boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sms_consent_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sms_consent_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sms_consent_method'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sms_consent_method text CHECK (
      sms_consent_method IS NULL OR 
      sms_consent_method IN ('web_form', 'written_form', 'verbal', 'employee_onboarding')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sms_consent_ip_address'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sms_consent_ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sms_consent_withdrawn_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sms_consent_withdrawn_date timestamptz;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.sms_consent_given IS 'TCPA Compliance: User has explicitly opted in to receive SMS notifications';
COMMENT ON COLUMN user_profiles.sms_consent_date IS 'TCPA Compliance: Timestamp when user provided consent';
COMMENT ON COLUMN user_profiles.sms_consent_method IS 'TCPA Compliance: Method used to collect consent (web_form, written_form, verbal, employee_onboarding)';
COMMENT ON COLUMN user_profiles.sms_consent_ip_address IS 'TCPA Compliance: IP address from which consent was given for audit trail';
COMMENT ON COLUMN user_profiles.sms_consent_withdrawn_date IS 'TCPA Compliance: Timestamp when user withdrew consent (if applicable)';
