/*
  # Create Education Videos Storage Bucket

  1. New Storage Bucket
    - `education-videos` - Stores uploaded educational video files
  
  2. Security
    - Authenticated users can upload videos
    - Public read access for all videos
    - Staff can delete videos
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('education-videos', 'education-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload education videos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'education-videos');

-- Allow public read access
CREATE POLICY "Public read access for education videos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'education-videos');

-- Allow staff to delete videos
CREATE POLICY "Staff can delete education videos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'education-videos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );