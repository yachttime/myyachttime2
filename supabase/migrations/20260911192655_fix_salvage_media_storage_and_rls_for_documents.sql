/*
# Fix salvage media storage and RLS policies for document attachments

## What this does
1. Adds an UPDATE policy on storage.objects for the salvage-media bucket,
   so that `upsert: true` uploads work (previously only INSERT/DELETE/SELECT
   policies existed -- the missing UPDATE caused upserts to fail silently).
2. Widens the salvage_report_media INSERT RLS policy to also allow `owner`
   and `manager` roles, not just `staff` and `master`. Owners can create
   estimates (added in a prior migration), and when they save an estimate
   linked to a salvage report the system auto-generates a PDF and tries to
   attach it. Without this policy change, the INSERT fails for owners and
   the document never appears in the salvage report UI.

## Security
- The UPDATE storage policy uses the same role check as INSERT (staff/master
  only), maintaining the same access level.
- The widened salvage_report_media INSERT policy still checks company_id
  match via get_user_company_id(), so cross-company inserts are blocked.
  Owners can only insert media for salvage reports in their own company.
*/

-- 1. Add UPDATE policy for salvage-media storage bucket
DROP POLICY IF EXISTS "Staff can update salvage media" ON storage.objects;
CREATE POLICY "Staff can update salvage media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'salvage-media'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'master'::user_role])
    AND user_profiles.is_active = true
  )
)
WITH CHECK (
  bucket_id = 'salvage-media'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'master'::user_role])
    AND user_profiles.is_active = true
  )
);

-- 2. Widen salvage_report_media INSERT policy to include owner and manager roles
DROP POLICY IF EXISTS "Staff can insert salvage report media" ON salvage_report_media;
CREATE POLICY "Staff can insert salvage report media"
ON salvage_report_media FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM salvage_reports
    WHERE salvage_reports.id = salvage_report_media.salvage_report_id
    AND salvage_reports.company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'master'::user_role, 'owner'::user_role, 'manager'::user_role])
      AND user_profiles.is_active = true
    )
  )
);

-- 3. Also widen the DELETE policy so owners can replace their document media
DROP POLICY IF EXISTS "Staff can delete salvage report media" ON salvage_report_media;
CREATE POLICY "Staff can delete salvage report media"
ON salvage_report_media FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM salvage_reports
    WHERE salvage_reports.id = salvage_report_media.salvage_report_id
    AND salvage_reports.company_id = get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'master'::user_role, 'owner'::user_role, 'manager'::user_role])
      AND user_profiles.is_active = true
    )
  )
);
