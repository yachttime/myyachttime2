/*
  # Add Taxable Flag to Labor Codes and Parts

  1. Changes
    - Add is_taxable field to labor_codes (default true)
    - Add is_taxable field to parts_inventory (default true)
    
  2. Notes
    - When creating estimates, line items will inherit taxable status from labor codes and parts
*/

-- Add is_taxable to labor_codes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'labor_codes' AND column_name = 'is_taxable'
  ) THEN
    ALTER TABLE labor_codes ADD COLUMN is_taxable boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Add is_taxable to parts_inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'parts_inventory' AND column_name = 'is_taxable'
  ) THEN
    ALTER TABLE parts_inventory ADD COLUMN is_taxable boolean DEFAULT true NOT NULL;
  END IF;
END $$;
