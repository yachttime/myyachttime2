/*
  # Increase Storage Bucket Size Limits for Photos

  1. Changes
    - Increase `yacht-documents` bucket size limit from 10MB to 200MB
    - Increase `repair-files` bucket size limit from 10MB to 200MB
    
  2. Reason
    - Modern smartphones take high-resolution photos that can exceed 10MB
    - Users need to upload large photo files for documentation and repair requests
    - 200MB limit accommodates high-quality photos and videos
*/

-- Update yacht-documents bucket to allow up to 200MB files
UPDATE storage.buckets
SET file_size_limit = 209715200 -- 200MB in bytes
WHERE id = 'yacht-documents';

-- Update repair-files bucket to allow up to 200MB files
UPDATE storage.buckets
SET file_size_limit = 209715200 -- 200MB in bytes
WHERE id = 'repair-files';
