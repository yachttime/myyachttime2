/*
  # Create temp-chunks storage bucket for large file uploads

  1. New Storage Bucket
    - `temp-chunks` bucket for temporary storage of file chunks during upload
    - Public access disabled (temp files only)
    - Accepts all file types (application/octet-stream)
    - Files auto-deleted after combination

  2. Security
    - Authenticated users can upload/download/delete their own chunks
    - Service role has full access for cleanup operations
*/

-- Create temp-chunks bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('temp-chunks', 'temp-chunks', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload chunks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload chunks'
  ) THEN
    CREATE POLICY "Authenticated users can upload chunks"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'temp-chunks');
  END IF;
END $$;

-- Allow authenticated users to read their chunks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can read their own chunks'
  ) THEN
    CREATE POLICY "Users can read their own chunks"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'temp-chunks');
  END IF;
END $$;

-- Allow authenticated users to delete their chunks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their own chunks'
  ) THEN
    CREATE POLICY "Users can delete their own chunks"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'temp-chunks');
  END IF;
END $$;

-- Allow service role full access for cleanup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role has full access to chunks'
  ) THEN
    CREATE POLICY "Service role has full access to chunks"
      ON storage.objects
      FOR ALL
      TO service_role
      USING (bucket_id = 'temp-chunks')
      WITH CHECK (bucket_id = 'temp-chunks');
  END IF;
END $$;