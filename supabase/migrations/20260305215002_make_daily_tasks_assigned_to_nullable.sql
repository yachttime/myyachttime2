/*
  # Make daily_tasks.assigned_to nullable

  ## Summary
  Allows daily tasks to be created without assigning them to a specific staff member.
  This supports the workflow where a task is known to be needed but the person who
  will do it hasn't been decided yet.

  ## Changes
  - `daily_tasks.assigned_to` — changed from NOT NULL to nullable
  - RLS policies updated so unassigned tasks (assigned_to IS NULL) are visible to
    managers/masters and can still be filtered correctly for staff
*/

ALTER TABLE daily_tasks
  ALTER COLUMN assigned_to DROP NOT NULL;

DROP POLICY IF EXISTS "Staff can view own tasks" ON daily_tasks;
DROP POLICY IF EXISTS "Staff can update own tasks" ON daily_tasks;

CREATE POLICY "Staff can view own or unassigned tasks"
  ON daily_tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR assigned_to IS NULL
    OR (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('master', 'manager', 'staff', 'mechanic')
  );

CREATE POLICY "Staff can update own tasks"
  ON daily_tasks FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid() OR assigned_to IS NULL)
  WITH CHECK (assigned_to = auth.uid() OR assigned_to IS NULL);
