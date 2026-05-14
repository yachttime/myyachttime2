/*
  # Fix staff_time_entries DELETE policy to allow manager role

  ## Change
  Drop and recreate DELETE policy to allow master and manager roles to delete entries.
*/

DROP POLICY IF EXISTS "Master can delete time entries" ON staff_time_entries;

CREATE POLICY "Manager and master can delete time entries"
  ON staff_time_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.role IN ('master', 'manager')
    )
  );
