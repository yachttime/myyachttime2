/*
# Add Mailing Address to Salvage Reports

1. Modified Tables
   - `salvage_reports`
     - Adds `owner_mailing_address` (text, nullable) -- Owner's mailing address if different from physical address
     - Existing `owner_address` column is now treated as the physical address
     - Backfills `owner_mailing_address` with the value from `owner_address` for existing reports where mailing address was not previously separate

2. Security
   - No policy changes needed -- the new column is covered by existing RLS policies on `salvage_reports`

3. Notes
   - The existing `owner_address` column remains and now represents the physical address
   - Both columns are nullable text fields
*/

-- Add owner_mailing_address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salvage_reports'
    AND column_name = 'owner_mailing_address'
  ) THEN
    ALTER TABLE salvage_reports ADD COLUMN owner_mailing_address text;
  END IF;
END $$;
