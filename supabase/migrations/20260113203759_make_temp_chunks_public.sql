/*
  # Make temp-chunks bucket public for video access

  1. Changes
    - Set temp-chunks bucket to public so videos stored there are accessible
    - Add proper MIME type restrictions for video files
  
  2. Security
    - Bucket becomes publicly readable
    - Upload policies remain restricted to authenticated users
*/

UPDATE storage.buckets
SET 
  public = true,
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/quicktime', 
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v',
    'application/octet-stream'
  ]
WHERE id = 'temp-chunks';