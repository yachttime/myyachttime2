/*
# Create identity_flags table for check-in and check-out identity mismatches

1. New Tables
- `identity_flags`: one row per check-in or check-out where the person confirming did not match the scheduled owner.
  - `id`, `company_id`, `booking_id` (the trip), `yacht_id`, `user_id` (the logged-in account that made the action)
  - `event_type` ('check_in' or 'check_out')
  - `scheduled_owner_name` (name on the master calendar at the time)
  - `confirmed_name` (name the person typed to confirm identity)
  - `reviewed_at`, `reviewed_by`, `review_notes` (set when office staff review the flag)
  - `created_at`

2. Security
- Enable RLS.
- Authenticated owners may insert flags for their own user in their own company.
- Staff and masters in the same company may select and update (to mark reviewed).
- No delete policy: flags are a permanent record.

3. Notes
- Grants are limited to the verbs used above.
*/

CREATE TABLE IF NOT EXISTS identity_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES yacht_bookings(id) ON DELETE SET NULL,
  yacht_id uuid REFERENCES yachts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('check_in', 'check_out')),
  scheduled_owner_name text NOT NULL,
  confirmed_name text NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_flags_company_created ON identity_flags(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_flags_booking ON identity_flags(booking_id);

ALTER TABLE identity_flags ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON identity_flags TO authenticated;

DROP POLICY IF EXISTS "select_identity_flags_staff" ON identity_flags;
CREATE POLICY "select_identity_flags_staff" ON identity_flags FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT up.company_id FROM user_profiles up WHERE up.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('staff', 'master'))
);

DROP POLICY IF EXISTS "insert_own_identity_flags" ON identity_flags;
CREATE POLICY "insert_own_identity_flags" ON identity_flags FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND company_id IN (SELECT up.company_id FROM user_profiles up WHERE up.user_id = auth.uid())
);

DROP POLICY IF EXISTS "update_identity_flags_staff" ON identity_flags;
CREATE POLICY "update_identity_flags_staff" ON identity_flags FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT up.company_id FROM user_profiles up WHERE up.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('staff', 'master'))
)
WITH CHECK (
  company_id IN (SELECT up.company_id FROM user_profiles up WHERE up.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('staff', 'master'))
);
