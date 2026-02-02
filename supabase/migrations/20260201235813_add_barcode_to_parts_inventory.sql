/*
  # Add Barcode Field to Parts Inventory

  1. Changes
    - Add `barcode` column to `parts_inventory` table
      - Stores barcode/UPC/EAN data for parts
      - Nullable to support legacy parts without barcodes
      - Indexed for fast lookups when scanning

  2. Purpose
    - Enable barcode scanning when adding/editing parts
    - Allow quick inventory lookups via barcode scanner
    - Support various barcode formats (UPC, EAN, Code 128, etc.)
*/

-- Add barcode column to parts_inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_inventory' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE parts_inventory ADD COLUMN barcode text;
  END IF;
END $$;

-- Create index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_parts_inventory_barcode ON parts_inventory(barcode) WHERE barcode IS NOT NULL;