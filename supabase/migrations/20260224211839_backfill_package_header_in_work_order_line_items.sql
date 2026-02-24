/*
  # Backfill package_header in work_order_line_items from source estimates

  ## Summary
  Work orders that were converted from estimates before the package_header column was
  added lost their package header values. This migration matches work_order_line_items
  back to their originating estimate_line_items and copies the package_header value.

  ## Logic
  - Only updates rows where package_header IS NULL, description is empty, line_type is 'labor'
  - Matches by work_order estimate_id, task_order, and line_order
*/

UPDATE work_order_line_items woli
SET package_header = sub.package_header
FROM (
  SELECT
    woli2.id AS woli_id,
    eli.package_header
  FROM work_order_line_items woli2
  JOIN work_order_tasks wot ON wot.id = woli2.task_id
  JOIN work_orders wo ON wo.id = wot.work_order_id
  JOIN estimate_tasks et ON et.estimate_id = wo.estimate_id
    AND et.task_order = wot.task_order
  JOIN estimate_line_items eli ON eli.task_id = et.id
    AND eli.line_order = woli2.line_order
    AND eli.line_type = woli2.line_type
    AND eli.description = woli2.description
  WHERE woli2.package_header IS NULL
    AND woli2.description = ''
    AND woli2.line_type = 'labor'
    AND eli.package_header IS NOT NULL
    AND wo.estimate_id IS NOT NULL
) sub
WHERE woli.id = sub.woli_id;
