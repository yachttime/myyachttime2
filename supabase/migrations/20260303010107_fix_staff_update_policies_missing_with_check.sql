/*
  # Fix missing WITH CHECK on staff UPDATE policies

  ## Problem
  Several UPDATE policies are missing a WITH CHECK clause. When WITH CHECK is absent,
  Postgres reuses the USING clause as the post-update check. If the USING clause
  checks a column value that changes during the update (e.g. status = 'pending'),
  the update succeeds but the row then fails the recheck and is silently rejected.

  ## Tables Fixed
  1. staff_schedule_overrides — "Master and staff can update schedule overrides"
  2. staff_schedules — "Staff can update schedules"
  3. staff_time_off_requests — "Staff can update time off requests"
     (USING requires status = 'pending', but approving changes status — needs WITH CHECK
      that allows master/staff to set any status)
  4. user_profiles — "Users can update own profile and staff can update all"

  ## Changes
  Each policy gets a WITH CHECK that verifies the actor has permission to write
  without re-checking the row's resulting state constraints.
*/

-- 1. staff_schedule_overrides
DROP POLICY IF EXISTS "Master and staff can update schedule overrides" ON staff_schedule_overrides;

CREATE POLICY "Master and staff can update schedule overrides"
  ON staff_schedule_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = ANY (ARRAY['master'::user_role, 'staff'::user_role, 'mechanic'::user_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = ANY (ARRAY['master'::user_role, 'staff'::user_role, 'mechanic'::user_role])
    )
  );

-- 2. staff_schedules
DROP POLICY IF EXISTS "Staff can update schedules" ON staff_schedules;

CREATE POLICY "Staff can update schedules"
  ON staff_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = ANY (ARRAY['master'::user_role, 'staff'::user_role, 'mechanic'::user_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = ANY (ARRAY['master'::user_role, 'staff'::user_role, 'mechanic'::user_role])
    )
  );

-- 3. staff_time_off_requests
-- USING: own pending rows OR master/staff/mechanic (they can approve/deny any)
-- WITH CHECK: own rows OR master/staff/mechanic (no state restriction after update)
DROP POLICY IF EXISTS "Staff can update time off requests" ON staff_time_off_requests;

CREATE POLICY "Staff can update time off requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = ANY (ARRAY['master'::user_role, 'staff'::user_role, 'mechanic'::user_role])
    )
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = ANY (ARRAY['master'::user_role, 'staff'::user_role, 'mechanic'::user_role])
    )
  );

-- 4. user_profiles
DROP POLICY IF EXISTS "Users can update own profile and staff can update all" ON user_profiles;

CREATE POLICY "Users can update own profile and staff can update all"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid()) OR is_staff()
  )
  WITH CHECK (
    (user_id = auth.uid()) OR is_staff()
  );
