/*
  # Allow staff and mechanic roles to insert daily tasks

  The "Send to Daily Task" feature on repair requests is used by staff and mechanic
  roles, but the INSERT policy only allowed master and manager. This migration
  extends the INSERT policy to include staff and mechanic.
*/

DROP POLICY IF EXISTS "Master and manager can create daily tasks" ON daily_tasks;

CREATE POLICY "Master, manager, staff and mechanic can create daily tasks"
  ON daily_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT user_profiles.company_id FROM user_profiles WHERE user_profiles.user_id = auth.uid() LIMIT 1)
    AND (SELECT user_profiles.role FROM user_profiles WHERE user_profiles.user_id = auth.uid() LIMIT 1)
      = ANY (ARRAY['master'::user_role, 'manager'::user_role, 'staff'::user_role, 'mechanic'::user_role])
  );
