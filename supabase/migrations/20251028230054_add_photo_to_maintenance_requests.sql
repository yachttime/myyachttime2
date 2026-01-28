/*
  # Add photo attachment to maintenance requests

  1. Changes
    - Add `photo_url` column to `maintenance_requests` table to store uploaded photo URLs
    - Allow NULL values since photo uploads are optional

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_requests' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE maintenance_requests ADD COLUMN photo_url text;
  END IF;
END $$;
