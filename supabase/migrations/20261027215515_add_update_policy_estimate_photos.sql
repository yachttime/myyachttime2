/*
# Add UPDATE policy for estimate_photos captions

## Summary
Allows the photo creator or a master to update the caption on an estimate photo
after it has been uploaded.

## Security
- RLS UPDATE policy on estimate_photos: creator or master can update
- GRANT UPDATE added for authenticated role
*/

-- Grant UPDATE on estimate_photos to authenticated
GRANT UPDATE ON estimate_photos TO authenticated;

-- Creator or master can update photo caption
DROP POLICY IF EXISTS "Creators and masters can update estimate photos" ON estimate_photos;
CREATE POLICY "Creators and masters can update estimate photos"
  ON estimate_photos FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'master'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'master'
    )
  );
