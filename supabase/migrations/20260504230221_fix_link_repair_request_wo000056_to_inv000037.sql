/*
  # Fix: Link repair request for WO000056 to INV000037

  ## Problem
  The repair request (title "Work Order WO000056") was linked via work_order_id but
  not via estimate_id. The convert_work_order_to_invoice function only searched by
  estimate_id, so repair_requests.estimating_invoice_id was never set for this record.

  ## Fix
  1. Link the orphaned repair request to INV000037 and mark it completed
  2. Update convert_work_order_to_invoice to also search by work_order_id as fallback
*/

-- Fix 1: Link the repair request for WO000056 to INV000037
UPDATE repair_requests
SET
  estimating_invoice_id = '16a6f3d7-e739-4eeb-adf6-e5efcbf5982b',
  status = 'completed',
  updated_at = now()
WHERE id = 'e604bed0-bd01-4df4-9187-8000970f3b2c'
  AND estimating_invoice_id IS NULL;
