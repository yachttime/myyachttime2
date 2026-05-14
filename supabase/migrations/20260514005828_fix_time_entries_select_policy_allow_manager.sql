/*
  # Fix staff_time_entries SELECT policy to allow manager role

  ## Problem
  The SELECT policy only allows master role to view other users' entries.
  A manager trying to edit Will's entry can't read it back after saving.

  ## Change
  Drop and recreate SELECT policy to allow manager and master to view all entries.
*/

DROP POLICY IF EXISTS "Master can view all time entries" ON staff_time_entries;

CREATE POLICY "Users view own, manager and master view all time entries"
  ON staff_time_entries
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.role IN ('master', 'manager')
    )
  );
