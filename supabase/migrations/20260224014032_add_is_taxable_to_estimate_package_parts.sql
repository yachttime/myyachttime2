/*
  # Add is_taxable to estimate_package_parts

  ## Summary
  Adds an is_taxable column to estimate_package_parts so that Mercury Marine
  and Marine Wholesale parts are always stored as taxable when added to packages.

  ## Changes
  - estimate_package_parts: add `is_taxable` boolean column, default false
  - Sets is_taxable = true for all existing Mercury and Marine Wholesale parts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_package_parts' AND column_name = 'is_taxable'
  ) THEN
    ALTER TABLE estimate_package_parts ADD COLUMN is_taxable boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE estimate_package_parts
SET is_taxable = true
WHERE part_source IN ('mercury', 'marine_wholesale');
