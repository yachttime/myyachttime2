/*
  # Add Multi-Source Parts Support to Estimate Package Parts

  ## Summary
  Extends estimate_package_parts to support parts from all three sources:
  - parts_inventory (shop inventory) - existing
  - mercury_marine_parts (Mercury catalog)
  - marine_wholesale_parts (Marine Wholesale catalog)

  ## Changes
  - estimate_package_parts: add `mercury_part_id`, `marine_wholesale_part_id`, `part_source`
  - `part_source` values: 'inventory', 'mercury', 'marine_wholesale', 'custom'
  - `part_id` made nullable since other sources may be used instead
  - `part_number_display` and `description_display` added for denormalized display

  ## Notes
  - Existing rows will default to part_source = 'inventory'
  - part_id is kept for backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_package_parts' AND column_name = 'part_source'
  ) THEN
    ALTER TABLE estimate_package_parts ADD COLUMN part_source text NOT NULL DEFAULT 'inventory';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_package_parts' AND column_name = 'mercury_part_id'
  ) THEN
    ALTER TABLE estimate_package_parts ADD COLUMN mercury_part_id uuid REFERENCES mercury_marine_parts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_package_parts' AND column_name = 'marine_wholesale_part_id'
  ) THEN
    ALTER TABLE estimate_package_parts ADD COLUMN marine_wholesale_part_id uuid REFERENCES marine_wholesale_parts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_package_parts' AND column_name = 'part_number_display'
  ) THEN
    ALTER TABLE estimate_package_parts ADD COLUMN part_number_display text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_package_parts' AND column_name = 'description_display'
  ) THEN
    ALTER TABLE estimate_package_parts ADD COLUMN description_display text NOT NULL DEFAULT '';
  END IF;
END $$;

ALTER TABLE estimate_package_parts ALTER COLUMN part_id DROP NOT NULL;
