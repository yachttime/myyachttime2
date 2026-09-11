/*
# Add Mailing Address to Companies

1. Modified Tables
   - `companies`
     - Adds `mailing_address` (text, nullable) -- Company mailing address if different from physical address

2. Security
   - No policy changes needed -- the new column is covered by existing RLS policies on `companies`

3. Notes
   - The existing `address` column represents the physical/street address
   - The new `mailing_address` column is for a separate mailing address (PO Box, etc.)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies'
    AND column_name = 'mailing_address'
  ) THEN
    ALTER TABLE companies ADD COLUMN mailing_address text;
  END IF;
END $$;
