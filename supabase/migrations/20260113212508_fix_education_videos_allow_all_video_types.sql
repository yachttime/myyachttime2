/*
  # Fix Education Videos Bucket - Allow All Video MIME Types

  1. Changes
    - Update education-videos bucket to allow all common video MIME types
    - Ensures videos can be uploaded and played regardless of format
  
  2. Supported Formats
    - MP4, MOV, AVI, WMV, FLV, MKV, WebM, M4V, MPEG, OGG, 3GP, 3G2
    - Also includes common alternate MIME type representations
*/

-- Update education-videos bucket to explicitly support all video types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/webm',
  'video/x-matroska',
  'video/x-m4v',
  'video/3gpp',
  'video/3gpp2',
  'video/ogg',
  'video/x-ms-asf',
  'video/avi',
  'video/msvideo',
  'video/x-mpeg'
]
WHERE id = 'education-videos';