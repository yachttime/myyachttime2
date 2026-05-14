/*
  # Restrict time entry edits to master role only

  Previously staff could update their own active (open) time entries.
  Now only masters can update any time entry. Staff can still insert
  (punch in/out via the time clock) but cannot edit existing records.

  Changes:
  - DROP existing UPDATE policy that allowed staff to update their own entries
  - CREATE new UPDATE policy restricted to master role only
  - DROP existing DELETE policy that included manager role
  - CREATE new DELETE policy restricted to master role only
*/

DROP POLICY IF EXISTS "Staff update own active entries, manager and master update any" ON staff_time_entries;
DROP POLICY IF EXISTS "Manager and master can delete time entries" ON staff_time_entries;

CREATE POLICY "Only master can update time entries"
  ON staff_time_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Only master can delete time entries"
  ON staff_time_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = 'master'
    )
  );
