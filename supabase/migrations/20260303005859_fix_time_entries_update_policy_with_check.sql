/*
  # Fix staff_time_entries UPDATE policy WITH CHECK

  ## Problem
  The existing UPDATE policy has no WITH CHECK clause, causing Postgres to reuse
  the USING clause as the WITH CHECK. The USING clause requires punch_out_time IS NULL,
  but after an employee punches out, punch_out_time is set — so the row fails the
  post-update check and the update is silently blocked.

  ## Fix
  Drop the old policy and recreate it with a proper WITH CHECK that only verifies
  the user owns the row (not the punch_out_time state), while the USING clause
  still ensures they can only update their own open entries.

  ## Changes
  - Updated: "Master can update all time entries" policy on staff_time_entries
    - USING: unchanged (only own entries where punch_out_time IS NULL, or master role)
    - WITH CHECK: allows the update to result in any state as long as user_id matches
*/

DROP POLICY IF EXISTS "Master can update all time entries" ON staff_time_entries;

CREATE POLICY "Master can update all time entries"
  ON staff_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND punch_out_time IS NULL)
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
      AND user_profiles.role = 'master'
    )
  );
