/*
  # Add Taxable and Surcharge Flags

  1. Changes
    - Add is_taxable field to estimate_line_items (default true)
    - Add apply_surcharge field to estimate_tasks (default true)
    
  2. Notes
    - Sales tax only applies to line items marked as taxable
    - Surcharge only applies to tasks marked with apply_surcharge
*/

-- Add is_taxable to estimate_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimate_line_items' AND column_name = 'is_taxable'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN is_taxable boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Add apply_surcharge to estimate_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimate_tasks' AND column_name = 'apply_surcharge'
  ) THEN
    ALTER TABLE estimate_tasks ADD COLUMN apply_surcharge boolean DEFAULT true NOT NULL;
  END IF;
END $$;
