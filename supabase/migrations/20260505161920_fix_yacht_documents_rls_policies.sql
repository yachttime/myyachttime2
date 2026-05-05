/*
  # Fix yacht_documents RLS policies

  The original policies on yacht_documents were dropped by a later security consolidation
  migration but never recreated, leaving RLS enabled with no policies — blocking all access.

  This migration recreates the full set of policies:
  - SELECT: all authenticated users with yacht access (owners see their yacht, staff/master see all)
  - INSERT: staff, master, and manager roles
  - UPDATE: staff, master, and manager roles
  - DELETE: staff, master, and manager roles
*/

-- SELECT: owners see their own yacht's docs; staff/master/manager/mechanic see all
CREATE POLICY "Users can view documents for their accessible yachts"
  ON yacht_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND (
        user_profiles.role IN ('staff', 'master', 'mechanic')
        OR (user_profiles.role = 'manager' AND user_profiles.company_id = (
          SELECT company_id FROM yachts WHERE yachts.id = yacht_documents.yacht_id
        ))
        OR (user_profiles.role = 'owner' AND user_profiles.yacht_id = yacht_documents.yacht_id)
      )
    )
  );

-- INSERT: staff, master, manager
CREATE POLICY "Staff and managers can insert yacht documents"
  ON yacht_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

-- UPDATE: staff, master, manager
CREATE POLICY "Staff and managers can update yacht documents"
  ON yacht_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

-- DELETE: staff, master, manager
CREATE POLICY "Staff and managers can delete yacht documents"
  ON yacht_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );
