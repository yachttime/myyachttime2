/*
  # Create Company Logos Storage Bucket

  1. New Storage Bucket
    - `company-logos` - Public bucket for company logo files
    
  2. Security
    - Allow public read access so logos can be displayed anywhere
    - Only master role can upload/update/delete logos
*/

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access to company logos" ON storage.objects;
DROP POLICY IF EXISTS "Master users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Master users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Master users can delete company logos" ON storage.objects;

-- Allow public read access to company logos
CREATE POLICY "Public read access to company logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Allow master users to upload logos
CREATE POLICY "Master users can upload company logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Allow master users to update logos
CREATE POLICY "Master users can update company logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Allow master users to delete logos
CREATE POLICY "Master users can delete company logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );