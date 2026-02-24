/*
  # Add package_header to estimate_line_items

  ## Summary
  Adds a `package_header` column to `estimate_line_items` to persist the package
  name label row that is inserted when a user adds a package to an estimate task.

  ## Changes
  - `estimate_line_items`: new nullable text column `package_header`
    - When set, the row acts as a visual grouping header (not a billable item)
    - When null, the row is a normal labor/part line item
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'package_header'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN package_header text;
  END IF;
END $$;
