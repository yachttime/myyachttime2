/*
  # Create Storage Bucket for Yacht Documents

  1. Storage Setup
    - Creates a new storage bucket named `yacht-documents` for file uploads
    - Enables public access for document viewing
    
  2. Security Policies
    - Allow authenticated users to upload files to their yacht documents
    - Allow authenticated users to read all yacht documents
    - Allow authenticated users to delete their own uploaded documents
    
  3. Configuration
    - Set maximum file size limit
    - Configure allowed file types (PDF, images, documents)
*/

-- Create the storage bucket for yacht documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yacht-documents',
  'yacht-documents',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload yacht documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'yacht-documents' AND
  auth.uid() IS NOT NULL
);

-- Allow authenticated users to read all yacht documents
CREATE POLICY "Authenticated users can view yacht documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'yacht-documents');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete their own yacht documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'yacht-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update their own yacht documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'yacht-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
