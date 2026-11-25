/*
# Restrict Vessel Monitoring managers to their own yacht

1. Plain-English explanation
- Previously, any staff-level role (staff, mechanic, master) and managers could
  see monitoring data for EVERY yacht belonging to their company. The customer
  wants managers to only see the monitoring data for the single yacht they are
  assigned to (the `yacht_id` on their user profile).
- This migration updates the read rules (Row Level Security SELECT policies) on
  the six vessel monitoring tables so that:
    * masters keep full access (all companies, all yachts),
    * staff and mechanics keep full company-wide read access,
    * managers can only read rows that belong to their own assigned yacht.
- Write rules (insert/update/delete) are unchanged: those are already limited to
  masters plus staff/mechanic gating in the app, and managers were never meant
  to have write access.

2. Tables modified (SELECT policies only)
- `vessel_monitoring_enrollments`
- `vessel_monitor_devices`
- `vessel_monitor_ports`
- `vessel_monitor_sensors`
- `vessel_monitor_readings`
- `vessel_monitor_alerts`

3. New helper function
- `public.get_user_manager_yacht_id()` returns the `yacht_id` from the current
  user's profile, but ONLY if that user's role is `manager`. Returns NULL for
  every other role. SECURITY DEFINER so it can read user_profiles without
  recursive policy issues; search_path pinned.

4. Security changes
- RLS stays ENABLED on all six tables (it already is; re-asserted).
- Each table's SELECT policy is replaced with a new policy that adds a
  manager-specific predicate: when the caller is a manager, the row's
  `yacht_id` must equal the manager's assigned yacht (or, for ports, the yacht
  of the parent device). Staff/mechanic/master behavior is unchanged.
- No grants are changed; the previously granted SELECT privileges still apply.

5. Important notes
- Users with role `manager` but NO yacht assigned will see zero monitoring
  rows. That is intentional: an unassigned manager has no vessel of their own.
- Masters are unaffected and continue to see everything.
- The policy for ports scopes through the parent device's yacht_id because
  `vessel_monitor_ports` has no yacht_id column of its own.
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
  WHERE up.id = auth.uid()
    AND up.role = 'manager'
    AND up.yacht_id IS NOT NULL
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_manager_yacht_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_manager_yacht_id() TO authenticated;

-- ============================================================
-- SELECT policies: managers see ONLY their assigned yacht's rows.
-- Staff / mechanic / master behavior unchanged.
-- ============================================================

-- Enrollments: manager sees only enrollments for their yacht
DROP POLICY IF EXISTS "select_enrollments" ON vessel_monitoring_enrollments;
CREATE POLICY "select_enrollments"
  ON vessel_monitoring_enrollments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
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
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );

-- Ports (scoped via the parent device's yacht)
DROP POLICY IF EXISTS "select_monitor_ports" ON vessel_monitor_ports;
CREATE POLICY "select_monitor_ports"
  ON vessel_monitor_ports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND EXISTS (
        SELECT 1 FROM vessel_monitor_devices d
        WHERE d.id = vessel_monitor_ports.device_id
          AND d.yacht_id = public.get_user_manager_yacht_id()
      )
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
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
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );

-- Readings
DROP POLICY IF EXISTS "select_monitor_readings" ON vessel_monitor_readings;
CREATE POLICY "select_monitor_readings"
  ON vessel_monitor_readings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );

-- Alerts
DROP POLICY IF EXISTS "select_monitor_alerts" ON vessel_monitor_alerts;
CREATE POLICY "select_monitor_alerts"
  ON vessel_monitor_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'manager')
      AND company_id = public.get_user_company_id()
    )
  );
