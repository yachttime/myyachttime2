/*
  # Fix inspection-photos bucket to allow all image MIME types

  ## Problem
  When iOS devices (iPhones) upload HEIC/HEIF photos via a browser, the MIME type
  reported is sometimes 'application/octet-stream' instead of 'image/heic' or 'image/heif'.
  The bucket's allowed_mime_types list was rejecting these uploads silently.

  ## Fix
  Set allowed_mime_types to NULL on the inspection-photos bucket, which allows any
  file type. Since this is an internal tool used only by authenticated staff/mechanics,
  restricting by MIME type provides no meaningful security benefit.
*/

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'inspection-photos';
