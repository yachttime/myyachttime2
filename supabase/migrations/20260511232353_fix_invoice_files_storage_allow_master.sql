/*
  # Fix invoice-files storage bucket to allow master role uploads

  The INSERT policy on invoice-files storage only allowed staff and manager roles,
  but master role users also need to upload invoice PDFs when marking repairs complete.
*/

DROP POLICY IF EXISTS "Staff and managers can upload invoice files" ON storage.objects;

CREATE POLICY "Staff and managers can upload invoice files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'manager'::user_role, 'master'::user_role, 'mechanic'::user_role])
    )
  );

DROP POLICY IF EXISTS "Staff can delete invoice files" ON storage.objects;

CREATE POLICY "Staff can delete invoice files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'manager'::user_role, 'master'::user_role])
    )
  );
