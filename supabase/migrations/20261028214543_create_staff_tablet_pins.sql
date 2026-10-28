/*
# Staff tablet PINs (master-only setting)

1. New Tables
- `staff_tablet_pins`: one row per staff, master, or mechanic who has a tablet PIN.
  - `user_id` (uuid, primary key, references user_profiles.user_id, cascades on delete)
  - `company_id` (uuid, not null)
  - `pin_hash` (text, bcrypt hash of the 6-digit PIN; the PIN itself is never stored)
  - `failed_attempts` (int, reset on successful unlock; used later for rate limiting)
  - `locked_until` (timestamptz, reserved for rate limiting)
  - `updated_at`, `updated_by`

2. Functions
- `set_staff_tablet_pin(p_user_id, p_pin)`: sets or changes a PIN. Only a signed-in master can call it. The target must be an active staff, master, or mechanic in the master's current company. The PIN must be exactly 6 digits.

3. Security
- RLS is enabled on `staff_tablet_pins` with no policies and no grants to anon or authenticated, so the table cannot be read or written directly from the browser.
- The function runs as SECURITY DEFINER with a fixed search_path. PUBLIC and anon cannot execute it; only authenticated users can, and the function itself rejects non-masters.

4. Notes
- Changing a PIN resets its failed-attempt counter.
- Verifying a PIN at unlock is a separate function added later.
*/

CREATE TABLE IF NOT EXISTS staff_tablet_pins (
  user_id uuid PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE staff_tablet_pins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_staff_tablet_pin(p_user_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_company_id uuid;
  v_target_company_id uuid;
  v_target_role text;
  v_target_active boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Only a master can set tablet PINs' USING ERRCODE = '42501';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 6 digits' USING ERRCODE = '22023';
  END IF;

  v_company_id := get_user_company_id();

  SELECT company_id, role, is_active
    INTO v_target_company_id, v_target_role, v_target_active
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF v_target_role IS NULL
     OR v_target_role NOT IN ('staff', 'master', 'mechanic')
     OR v_target_active IS FALSE
     OR v_target_company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'Tablet PINs can only be set for active staff in your company' USING ERRCODE = '42501';
  END IF;

  INSERT INTO staff_tablet_pins (user_id, company_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by)
  VALUES (
    p_user_id,
    v_company_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    0,
    NULL,
    now(),
    auth.uid()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    pin_hash = EXCLUDED.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = now(),
    updated_by = auth.uid();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION set_staff_tablet_pin(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_staff_tablet_pin(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION set_staff_tablet_pin(uuid, text) TO authenticated;
