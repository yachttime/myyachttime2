/*
  # Create Storage Bucket for Repair Request Files

  1. Storage Setup
    - Creates a new storage bucket named `repair-files` for repair request attachments
    - Enables public access for file viewing
    - Sets 10MB file size limit
    
  2. Security Policies
    - Allow authenticated users to upload files to repair-files bucket
    - Allow authenticated users to read all repair files
    - Allow users to delete their own uploaded repair files
    - Allow users to update their own uploaded repair files
    
  3. Allowed File Types
    - PDF documents for reports and documentation
    - Images (JPEG, PNG, GIF) for photos of repair issues
    - Common document formats (Word, Excel, text files)
*/

-- Create the storage bucket for repair request files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'repair-files',
  'repair-files',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload repair files
CREATE POLICY "Authenticated users can upload repair files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'repair-files' AND
  auth.uid() IS NOT NULL
);

-- Allow authenticated users to read all repair files
CREATE POLICY "Authenticated users can view repair files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'repair-files');

-- Allow users to delete their own repair file uploads
CREATE POLICY "Users can delete their own repair files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'repair-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own repair file uploads
CREATE POLICY "Users can update their own repair files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'repair-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);