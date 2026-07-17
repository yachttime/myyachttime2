/*
# Create Receipts Storage Bucket

1. New Storage Bucket
   - `receipts` - stores receipt photos/images uploaded by employees
   - Public bucket for signed URL access
   - Allows image types (jpeg, png, heic, webp) and PDF
   - 10MB file size limit

2. Security
   - Staff, mechanic, and master roles can upload files
   - Staff, mechanic, and master roles can read all files
   - Master can delete files
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for receipts bucket
DROP POLICY IF EXISTS "Staff can upload receipts" ON storage.objects;
CREATE POLICY "Staff can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'mechanic', 'master')
  )
);

DROP POLICY IF EXISTS "Staff can view receipts" ON storage.objects;
CREATE POLICY "Staff can view receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'mechanic', 'master')
  )
);

DROP POLICY IF EXISTS "Master can delete receipts" ON storage.objects;
CREATE POLICY "Master can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role = 'master'
  )
);
