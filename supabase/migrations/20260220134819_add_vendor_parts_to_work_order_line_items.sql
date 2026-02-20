/*
  # Add Vendor Parts Support to Work Order Line Items

  1. Changes
    - Add `part_source` column to work_order_line_items
      - Values: 'inventory', 'mercury', 'marine_wholesale', 'custom'
      - Defaults to 'inventory' to preserve existing data
    - Add `mercury_part_id` column referencing mercury_marine_parts
    - Add `marine_wholesale_part_id` column referencing marine_wholesale_parts

  2. Notes
    - All new columns are nullable to avoid breaking existing records
    - Existing rows will have part_source = 'inventory' by default
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'part_source'
  ) THEN
    ALTER TABLE work_order_line_items
      ADD COLUMN part_source varchar(20) DEFAULT 'inventory'
        CHECK (part_source IN ('inventory', 'mercury', 'marine_wholesale', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'mercury_part_id'
  ) THEN
    ALTER TABLE work_order_line_items
      ADD COLUMN mercury_part_id uuid REFERENCES mercury_marine_parts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'marine_wholesale_part_id'
  ) THEN
    ALTER TABLE work_order_line_items
      ADD COLUMN marine_wholesale_part_id uuid REFERENCES marine_wholesale_parts(id) ON DELETE SET NULL;
  END IF;
END $$;
