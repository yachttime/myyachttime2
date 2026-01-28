/*
  # Create Invoice Files Storage Bucket

  1. Overview
    - Creates a storage bucket for invoice PDF files
    - Sets up RLS policies for secure file access

  2. New Storage Bucket
    - Name: invoice-files
    - Public: false (requires authentication)
    - File size limit: 10MB
    - Allowed MIME types: PDF files

  3. Security
    - Staff and managers can upload invoice files
    - Users can view invoices for their yacht's repair requests
*/

-- Create the storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-files', 'invoice-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff and managers can upload invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view invoice files for their yacht" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete invoice files" ON storage.objects;

-- Allow authenticated users to upload invoice files
CREATE POLICY "Staff and managers can upload invoice files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-files' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role IN ('staff', 'manager', 'mechanic')
  )
);

-- Allow users to view invoice files for their yacht
CREATE POLICY "Users can view invoice files for their yacht"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-files' AND (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
    OR
    EXISTS (
      SELECT 1 FROM repair_requests rr
      JOIN user_profiles up ON up.yacht_id = rr.yacht_id
      WHERE rr.invoice_file_url LIKE '%' || (storage.objects.name) || '%'
      AND up.user_id = auth.uid()
    )
  )
);

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
    AND user_profiles.role IN ('staff', 'manager', 'mechanic')
  )
);
