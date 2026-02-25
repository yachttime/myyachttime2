/*
  # Backfill company_id on estimate_tasks, work_order_tasks, and work_order_line_items

  ## Summary
  Child tables (estimate_tasks, work_order_tasks, work_order_line_items) have NULL company_id
  on many rows because they were inserted before company_id propagation was added. RLS SELECT
  policies for staff/mechanic roles check company_id match, so rows with NULL company_id are
  invisible to those users when they open an estimate or work order.

  ## Changes
  1. Backfill estimate_tasks.company_id from parent estimates table
  2. Backfill work_order_tasks.company_id from parent work_orders table
  3. Backfill work_order_line_items.company_id from parent work_orders table

  ## Notes
  - Only updates rows where company_id IS NULL to avoid overwriting valid data
  - Safe to run multiple times (idempotent)
*/

UPDATE estimate_tasks et
SET company_id = e.company_id
FROM estimates e
WHERE et.estimate_id = e.id
  AND et.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE work_order_tasks wot
SET company_id = wo.company_id
FROM work_orders wo
WHERE wot.work_order_id = wo.id
  AND wot.company_id IS NULL
  AND wo.company_id IS NOT NULL;

UPDATE work_order_line_items woli
SET company_id = wo.company_id
FROM work_orders wo
WHERE woli.work_order_id = wo.id
  AND woli.company_id IS NULL
  AND wo.company_id IS NOT NULL;
