
/*
  # Add company_id to purchase_order_line_items

  ## Problem
  The `trg_auto_assign_company_id` trigger is applied to `purchase_order_line_items`
  but the table is missing the `company_id` column, causing the error:
  "record 'new' has no field 'company_id'"

  ## Changes
  - Add `company_id` column to `purchase_order_line_items`
  - Backfill existing rows from their parent purchase_order
  - Add RLS policies consistent with other estimating tables
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_line_items' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE purchase_order_line_items
      ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE purchase_order_line_items poli
SET company_id = po.company_id
FROM purchase_orders po
WHERE poli.purchase_order_id = po.id
  AND poli.company_id IS NULL
  AND po.company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_line_items_company_id
  ON purchase_order_line_items(company_id);
