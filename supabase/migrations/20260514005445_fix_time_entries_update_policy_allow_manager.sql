/*
  # Fix staff_time_entries UPDATE policy to allow manager and master roles

  ## Problem
  The existing UPDATE policy only lets employees update their own entries when
  still clocked in (punch_out_time IS NULL), or lets master update anything.
  This blocked master/manager users from editing completed time entries.

  ## Change
  Drop and recreate the UPDATE policy to allow:
  - Employees to update their own entry while still clocked in (punch_out_time IS NULL)
  - Master and manager roles to update any entry (for corrections/admin edits)
*/

DROP POLICY IF EXISTS "Master can update all time entries" ON staff_time_entries;

CREATE POLICY "Staff update own active entries, manager and master update any"
  ON staff_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND punch_out_time IS NULL)
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.role IN ('master', 'manager')
    )
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.role IN ('master', 'manager')
    )
  );
