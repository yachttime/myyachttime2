/*
  # Increase Education Videos Bucket File Size Limit to 5GB

  1. Changes
    - Update the `education-videos` bucket to allow files up to 5GB (5368709120 bytes)
    - This accommodates larger HD/4K video files
    - Previous limit of 1GB may have been insufficient for high-quality videos

  2. Notes
    - Most educational videos should fit within 5GB
    - If issues persist, may need to check Supabase project-level limits or tier restrictions
*/

-- Update the education-videos bucket to allow 5GB file size
UPDATE storage.buckets
SET file_size_limit = 5368709120
WHERE id = 'education-videos';
