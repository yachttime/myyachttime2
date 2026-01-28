/*
  # Fix Invoice Files Storage Bucket - Make Public

  1. Overview
    - Updates the invoice-files bucket to be public
    - Removes complex RLS policies that prevent PDF viewing
    - Enables direct access to invoice PDFs via public URLs

  2. Changes
    - Set bucket to public access
    - Keep upload restrictions to staff/managers only
    - Allow public read access to invoice files

  3. Security
    - Upload is still restricted to authenticated staff/managers
    - Files are publicly readable once uploaded
    - Delete is restricted to staff only
*/

-- Update the bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'invoice-files';

-- Drop existing policies
DROP POLICY IF EXISTS "Staff and managers can upload invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view invoice files for their yacht" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete invoice files" ON storage.objects;

-- Allow authenticated staff/managers to upload invoice files
CREATE POLICY "Staff and managers can upload invoice files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-files' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role IN ('staff', 'manager')
  )
);

-- Allow public read access to invoice files
CREATE POLICY "Public can view invoice files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'invoice-files');

-- Allow staff to delete invoice files
CREATE POLICY "Staff can delete invoice files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-files' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = 'staff'
  )
);
