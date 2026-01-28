/*
  # Fix Education Videos Bucket - Remove Size Limit

  1. Changes
    - Set file_size_limit to NULL (unlimited) for education-videos bucket
    - This allows large video files (multi-GB) to be uploaded
  
  2. Notes
    - Previous migrations failed due to conditional WHERE clauses
    - This migration uses a simple UPDATE to force the change
    - NULL means unlimited size
*/

-- Remove size limit from education-videos bucket
UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'education-videos';
