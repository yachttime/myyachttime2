/*
  # Add manager role to yacht_invoices INSERT policy

  Managers marking repair requests complete need to insert into yacht_invoices,
  but the INSERT policy only allowed staff, mechanic, and master roles.
  This extends it to include manager as well.
*/

DROP POLICY IF EXISTS "yacht_invoices_insert_policy" ON yacht_invoices;

CREATE POLICY "yacht_invoices_insert_policy"
  ON yacht_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    )
  );
