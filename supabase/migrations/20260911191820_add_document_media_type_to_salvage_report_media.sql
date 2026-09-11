/*
# Add "document" media type to salvage_report_media

## What this does
The salvage_report_media table has a CHECK constraint that only allows
three media types: photo_prior, photo_loss, and video_loss. This migration
adds 'document' as a fourth allowed type so that auto-generated PDFs
(estimates, work orders, invoices) can be attached to salvage reports.

## Changes
1. Drops the existing CHECK constraint `salvage_report_media_media_type_check`
2. Creates a new CHECK constraint that includes 'document' alongside the
   existing three types

## Security
No RLS policy changes needed -- existing INSERT/UPDATE/DELETE policies
already allow staff/master roles to manage media rows for reports in their
company, and the new media_type value falls under the same policies.
*/

ALTER TABLE salvage_report_media
  DROP CONSTRAINT salvage_report_media_media_type_check;

ALTER TABLE salvage_report_media
  ADD CONSTRAINT salvage_report_media_media_type_check
  CHECK (media_type = ANY (ARRAY['photo_prior'::text, 'photo_loss'::text, 'video_loss'::text, 'document'::text]));
