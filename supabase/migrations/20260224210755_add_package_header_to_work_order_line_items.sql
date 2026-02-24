/*
  # Add package_header to work_order_line_items

  ## Summary
  Adds the `package_header` column to `work_order_line_items` to match the same
  column that exists on `estimate_line_items`. This allows package grouping titles
  to be preserved when estimates are converted to work orders, and when work order
  line items are saved directly.

  ## Changes
  - `work_order_line_items`: adds `package_header text` (nullable)

  ## Also updates
  - The `approve_estimate` function to copy `package_header` from estimate line items
    into work order line items during the estimate-to-work-order conversion.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'package_header'
  ) THEN
    ALTER TABLE work_order_line_items ADD COLUMN package_header text;
  END IF;
END $$;
