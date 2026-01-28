/*
  # Remove File Size Limit from Education Videos Bucket

  1. Changes
    - Set file_size_limit to NULL to allow maximum size based on Supabase tier
    - This removes the explicit 5GB limit and uses the project-level limit instead

  2. Notes
    - NULL means no bucket-level restriction, only project-level applies
    - Should resolve upload issues for files under project tier limits
*/

UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'education-videos';
