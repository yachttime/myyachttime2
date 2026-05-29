/*
  # Restrict staff_time_entries INSERT to master role only

  ## Change
  The previous policy allowed both master and manager to insert time entries for any user.
  Per requirements, only the master role should be able to add/edit time entries.

  - Drop the master+manager INSERT policy
  - Re-create INSERT policy: own entry OR master inserting for any user
*/

DROP POLICY IF EXISTS "Staff insert own or master insert any time entries" ON staff_time_entries;

CREATE POLICY "Staff insert own or master insert any time entries"
  ON staff_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.role = 'master'
    )
  );
