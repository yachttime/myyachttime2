/*
  # Fix Smart Device Add/Edit/Delete Permissions (yacht_smart_devices)

  ## Problem
  Adding a device in Smart Device Management failed with
  "new row violates row-level security policy for table yacht_smart_devices".

  Root cause: the INSERT / UPDATE / DELETE policies on `yacht_smart_devices`
  ("Master can insert devices", "Master can update devices",
  "Master can delete devices") were written with an outdated identity check:

      EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() ...)

  `user_profiles.id` is the profile row's own key, NOT the signed-in auth user
  id (that is `user_profiles.user_id`). Every other table in the app was since
  migrated to `user_id = auth.uid()` (see 20260116011244), but this table's
  write policies were missed, so the check could never match any user and ALL
  device inserts (and edits/deletes by non-matching paths) were rejected.

  ## Changes

  1. Policies (replaced, idempotent drop-then-create)
  - DROP the three broken "Master can ..." write policies.
  - CREATE staff-pattern write policies consistent with the rest of the app
    (same shape as the `yachts` table policies):
      - "Staff can insert company smart devices"  (INSERT  WITH CHECK)
      - "Staff can update company smart devices"  (UPDATE  USING + WITH CHECK)
      - "Staff can delete company smart devices"  (DELETE  USING)
    Each requires the row's company to match the signed-in user's company
    (`company_id = get_user_company_id()`) AND the user to be staff-level
    (`is_staff()` includes staff, manager, mechanic, and master roles).
  - The existing SELECT policy ("Users can view company smart devices")
    is unchanged.

  2. Company assignment trigger
  - Device inserts from the app do not send company_id. Without it, a saved
    device would be invisible to everyone (company-filtered SELECT never
    matches NULL). New BEFORE INSERT trigger `trg_assign_smart_device_company`
    copies `company_id` from the parent yacht (`yachts.company_id`) when the
    insert leaves it NULL. This is correct for master users doing company
    switching too, because the device inherits the yacht's actual company
    rather than the profile's (possibly NULL) company.
  - Function `assign_smart_device_company()` is SECURITY DEFINER with a fixed
    search_path; only fires when company_id IS NULL (never overrides explicit
    values).

  ## Security
  - RLS stays enabled; SELECT remains company-scoped.
  - Writes now require company match + staff-level role, matching how every
    other operational table in the app authorizes writes.
  - Grants were already correct (SELECT/INSERT/UPDATE/DELETE to authenticated)
    and are re-asserted below for rebuild-from-empty safety.

  ## Notes
  - No data is modified; existing devices are untouched.
  - Safe to run multiple times.
*/

-- 1. Remove the broken write policies (identity checked the wrong column)
DROP POLICY IF EXISTS "Master can insert devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Master can update devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Master can delete devices" ON yacht_smart_devices;

-- 2. Recreate write policies with the corrected, app-wide staff pattern
CREATE POLICY "Staff can insert company smart devices"
ON yacht_smart_devices FOR INSERT
TO authenticated
WITH CHECK ((company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can update company smart devices"
ON yacht_smart_devices FOR UPDATE
TO authenticated
USING ((company_id = get_user_company_id()) AND is_staff())
WITH CHECK ((company_id = get_user_company_id()) AND is_staff());

CREATE POLICY "Staff can delete company smart devices"
ON yacht_smart_devices FOR DELETE
TO authenticated
USING ((company_id = get_user_company_id()) AND is_staff());

-- 3. Fill company_id from the parent yacht on insert when not provided
CREATE OR REPLACE FUNCTION assign_smart_device_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT y.company_id
      INTO NEW.company_id
      FROM yachts y
     WHERE y.id = NEW.yacht_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_smart_device_company ON yacht_smart_devices;
CREATE TRIGGER trg_assign_smart_device_company
BEFORE INSERT ON yacht_smart_devices
FOR EACH ROW EXECUTE FUNCTION assign_smart_device_company();

-- 4. Re-assert Data API grants (no-op if already present)
GRANT SELECT, INSERT, UPDATE, DELETE ON yacht_smart_devices TO authenticated;
