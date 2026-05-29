/*
  # Fix staff_time_entries INSERT policy to allow master role to insert for any user

  ## Problem
  The existing INSERT policy "Staff can create own time entries" only allows users to insert
  entries where user_id = their own auth.uid(). This blocks master/manager users from
  manually adding time entries on behalf of other staff members.

  ## Changes
  - Drop the restrictive INSERT policy
  - Re-create it to allow: own entries OR master/manager inserting for anyone
*/

DROP POLICY IF EXISTS "Staff can create own time entries" ON staff_time_entries;

CREATE POLICY "Staff insert own or master insert any time entries"
  ON staff_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.role IN ('master', 'manager')
    )
  );
