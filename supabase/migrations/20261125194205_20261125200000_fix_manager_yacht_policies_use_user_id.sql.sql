/*
# Fix manager yacht restriction to match profiles by user_id, not id

1. Plain-English explanation
- The previous migration ("Restrict Vessel Monitoring managers to their own
  yacht") matched the current user's profile with `user_profiles.id = auth.uid()`.
  In this database the sign-in identity is stored in `user_profiles.user_id`;
  `id` is a separate internal key, so those checks never matched anyone.
- Result: the "manager sees only their own yacht" branch never fired, and every
  manager silently fell through to the company-wide branch (seeing all monitored
  yachts of the company), while a manager assigned to a yacht with no monitoring
  devices saw nothing but the camera section.
- This migration re-creates the helper function and the six SELECT policies
  using `user_profiles.user_id = auth.uid()`, matching the convention used by
  `is_staff()` and `get_user_company_id()`.

2. Objects changed
- `public.get_user_manager_yacht_id()` — now matches `up.user_id = auth.uid()`.
- SELECT policies re-created (predicate logic unchanged, only the profile match
  column corrected):
  - `select_enrollments` on `vessel_monitoring_enrollments`
  - `select_monitor_devices` on `vessel_monitor_devices`
  - `select_monitor_ports` on `vessel_monitor_ports`
  - `select_monitor_sensors` on `vessel_monitor_sensors`
  - `select_monitor_readings` on `vessel_monitor_readings`
  - `select_monitor_alerts` on `vessel_monitor_alerts`

3. Security changes
- Managers (role = 'manager') can now only read monitoring rows for the yacht
  set on their own profile (`yacht_id`). Masters keep full access; staff and
  mechanics keep company-wide read access. No grants changed.

4. Important notes
- A manager with no `yacht_id` on their profile sees zero monitoring rows —
  intentional.
- Safe to re-run: policies are dropped before creation.
*/

CREATE OR REPLACE FUNCTION public.get_user_manager_yacht_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT up.yacht_id
  FROM user_profiles up
  WHERE up.user_id = auth.uid()
    AND up.role = 'manager'
    AND up.yacht_id IS NOT NULL
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_manager_yacht_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_manager_yacht_id() TO authenticated;

-- Enrollments
DROP POLICY IF EXISTS "select_enrollments" ON vessel_monitoring_enrollments;
CREATE POLICY "select_enrollments"
  ON vessel_monitoring_enrollments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND (
        provider_company_id = public.get_user_company_id()
        OR yacht_company_id = public.get_user_company_id()
      )
    )
  );

-- Devices
DROP POLICY IF EXISTS "select_monitor_devices" ON vessel_monitor_devices;
CREATE POLICY "select_monitor_devices"
  ON vessel_monitor_devices FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );

-- Ports (scoped through the parent device's yacht)
DROP POLICY IF EXISTS "select_monitor_ports" ON vessel_monitor_ports;
CREATE POLICY "select_monitor_ports"
  ON vessel_monitor_ports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND EXISTS (
        SELECT 1 FROM vessel_monitor_devices d
        WHERE d.id = vessel_monitor_ports.device_id
          AND d.yacht_id = public.get_user_manager_yacht_id()
      )
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND EXISTS (
        SELECT 1 FROM vessel_monitor_devices d
        WHERE d.id = vessel_monitor_ports.device_id
          AND d.company_id = public.get_user_company_id()
      )
    )
  );

-- Sensors
DROP POLICY IF EXISTS "select_monitor_sensors" ON vessel_monitor_sensors;
CREATE POLICY "select_monitor_sensors"
  ON vessel_monitor_sensors FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );

-- Readings
DROP POLICY IF EXISTS "select_monitor_readings" ON vessel_monitor_readings;
CREATE POLICY "select_monitor_readings"
  ON vessel_monitor_readings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );

-- Alerts
DROP POLICY IF EXISTS "select_monitor_alerts" ON vessel_monitor_alerts;
CREATE POLICY "select_monitor_alerts"
  ON vessel_monitor_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );
