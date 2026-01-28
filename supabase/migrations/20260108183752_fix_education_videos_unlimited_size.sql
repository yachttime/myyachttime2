/*
  # Remove File Size Limit for Education Videos Bucket

  1. Changes
    - Set file_size_limit to NULL for education-videos bucket
    - This removes the 5GB cap and allows uploads up to Pro tier limit (500GB)
  
  2. Security
    - Bucket remains public for read access
    - Upload policies remain unchanged
*/

-- Remove the file size limit to allow large video uploads
UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'education-videos';
