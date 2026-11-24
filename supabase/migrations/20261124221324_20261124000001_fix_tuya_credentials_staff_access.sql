/*
# Fix Tuya credential access for active staff

1. Purpose
- Restore Smart Device Management visibility for the Tuya credentials already stored for each yacht.
- Replace legacy credential policies that compared `user_profiles.id` to `auth.uid()` even though the authenticated identity is stored in `user_profiles.user_id`.
- Include all active operational staff roles used by the application, including managers and masters.

2. Modified Tables
- `tuya_device_credentials`
- No columns or stored credential values are changed.
- Credential rows remain associated with their existing `yacht_id`.

3. Security
- Remove legacy broad or incorrect credential policies.
- Keep access limited to authenticated active staff with access to the selected company.
- Keep credentials out of anonymous access.
- Use four separate policies for SELECT, INSERT, UPDATE, and DELETE.
- Keep table privileges limited to authenticated staff operations.

4. Important Notes
- The existing Orion Tuya credential record is preserved.
- This change affects authorization only; it does not rotate, decrypt, expose, or rewrite any secret.
*/

ALTER TABLE public.tuya_device_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tuya_device_credentials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tuya_device_credentials TO authenticated;

DROP POLICY IF EXISTS "Staff can manage device credentials" ON public.tuya_device_credentials;
DROP POLICY IF EXISTS "Master can view credentials" ON public.tuya_device_credentials;
DROP POLICY IF EXISTS "Master can insert credentials" ON public.tuya_device_credentials;
DROP POLICY IF EXISTS "Master can update credentials" ON public.tuya_device_credentials;
DROP POLICY IF EXISTS "Master can delete credentials" ON public.tuya_device_credentials;
DROP POLICY IF EXISTS "Staff can view device credentials" ON public.tuya_device_credentials;

CREATE POLICY "Staff can view company Tuya credentials"
ON public.tuya_device_credentials
FOR SELECT
TO authenticated
USING (
  is_staff()
  AND EXISTS (
    SELECT 1
    FROM public.yachts
    WHERE yachts.id = tuya_device_credentials.yacht_id
      AND yachts.company_id = get_user_company_id()
  )
);

CREATE POLICY "Staff can insert company Tuya credentials"
ON public.tuya_device_credentials
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff()
  AND EXISTS (
    SELECT 1
    FROM public.yachts
    WHERE yachts.id = tuya_device_credentials.yacht_id
      AND yachts.company_id = get_user_company_id()
  )
);

CREATE POLICY "Staff can update company Tuya credentials"
ON public.tuya_device_credentials
FOR UPDATE
TO authenticated
USING (
  is_staff()
  AND EXISTS (
    SELECT 1
    FROM public.yachts
    WHERE yachts.id = tuya_device_credentials.yacht_id
      AND yachts.company_id = get_user_company_id()
  )
)
WITH CHECK (
  is_staff()
  AND EXISTS (
    SELECT 1
    FROM public.yachts
    WHERE yachts.id = tuya_device_credentials.yacht_id
      AND yachts.company_id = get_user_company_id()
  )
);

CREATE POLICY "Staff can delete company Tuya credentials"
ON public.tuya_device_credentials
FOR DELETE
TO authenticated
USING (
  is_staff()
  AND EXISTS (
    SELECT 1
    FROM public.yachts
    WHERE yachts.id = tuya_device_credentials.yacht_id
      AND yachts.company_id = get_user_company_id()
  )
);