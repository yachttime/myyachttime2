/*
  # Add Video Support to Storage Buckets

  1. Changes
    - Add common video MIME types to `yacht-documents` bucket
    - Add common video MIME types to `repair-files` bucket
    - Increase size limits to 500MB to accommodate video files
    
  2. Supported Video Formats
    - MP4 (most common)
    - MOV (iPhone/Apple devices)
    - AVI, WMV, FLV, MKV (other common formats)
    - WebM (web-optimized)
    - M4V (iTunes/Apple)
    - 3GP, 3G2 (mobile devices)
*/

-- Update yacht-documents bucket to support videos and increase limit to 500MB
UPDATE storage.buckets
SET 
  file_size_limit = 524288000, -- 500MB in bytes
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v',
    'video/3gpp',
    'video/3gpp2'
  ]
WHERE id = 'yacht-documents';

-- Update repair-files bucket to support videos and increase limit to 500MB
UPDATE storage.buckets
SET 
  file_size_limit = 524288000, -- 500MB in bytes
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v',
    'video/3gpp',
    'video/3gpp2'
  ]
WHERE id = 'repair-files';

-- Ensure education-videos bucket also supports all video types
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v',
    'video/3gpp',
    'video/3gpp2',
    'video/mpeg',
    'video/ogg'
  ]
WHERE id = 'education-videos' AND allowed_mime_types IS NULL;
