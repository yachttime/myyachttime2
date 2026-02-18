/*
  # Add is_default flag to accounting_codes

  ## Changes
  - Adds `is_default_inventory` boolean column to `accounting_codes` table
  - Default is false; only one code should be marked as the default inventory asset code
  - This allows parts inventory to auto-select the default inventory asset accounting code when creating a new part
*/

ALTER TABLE accounting_codes
ADD COLUMN IF NOT EXISTS is_default_inventory boolean NOT NULL DEFAULT false;
