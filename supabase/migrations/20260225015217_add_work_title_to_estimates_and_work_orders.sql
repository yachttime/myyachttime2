/*
  # Add work_title to estimates and work_orders

  ## Summary
  Adds a `work_title` column to both the `estimates` and `work_orders` tables
  so users can give each estimate/work order a descriptive name (e.g. "Engine Service",
  "Hull Cleaning") that is visible in the list view without opening each record.

  ## Changes
  - `estimates`: add `work_title text` (nullable)
  - `work_orders`: add `work_title text` (nullable)

  When an estimate is approved and a work order is created, the work_title
  is copied over via the approve_estimate function (handled in application code).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'work_title'
  ) THEN
    ALTER TABLE estimates ADD COLUMN work_title text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'work_title'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN work_title text;
  END IF;
END $$;
