/*
  # Update Education Videos Bucket File Size Limit

  1. Changes
    - Update the `education-videos` bucket to allow files up to 1GB (1073741824 bytes)
    - This allows users to upload larger video files without hitting size limits

  2. Notes
    - Default Supabase bucket limit is 50MB which is too small for video content
    - 1GB should accommodate most educational videos while preventing abuse
*/

-- Update the education-videos bucket to allow 1GB file size
UPDATE storage.buckets
SET file_size_limit = 1073741824
WHERE id = 'education-videos';
