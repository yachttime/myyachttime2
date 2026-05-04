/*
  # Backfill repair request deposits to estimates and work orders

  ## Overview
  Populate the new repair_request_deposit_* columns on estimates and fix any
  work orders that should have had a deposit carried from their repair request
  but didn't (due to the timing gap in the old approve_estimate logic).

  Also links repair_requests.work_order_id for any repair requests that were
  linked via estimate_id but never got the work_order_id set.

  ## Changes
  1. Populate estimates.repair_request_deposit_* for all paid repair request deposits
  2. Update work_orders with missing deposit info from linked repair requests
  3. Set repair_requests.work_order_id for any missing links
*/

-- Step 1: Backfill estimate deposit sync columns from paid repair requests
UPDATE estimates e
SET
  repair_request_deposit_status = 'paid',
  repair_request_deposit_amount = rr.deposit_amount,
  repair_request_deposit_paid_at = rr.deposit_paid_at,
  repair_request_deposit_method = rr.deposit_payment_method_type,
  updated_at = now()
FROM repair_requests rr
WHERE rr.estimate_id = e.id
  AND rr.deposit_payment_status = 'paid'
  AND rr.deposit_amount IS NOT NULL
  AND (e.repair_request_deposit_status IS NULL OR e.repair_request_deposit_status != 'paid');

-- Step 2: Link repair_requests.work_order_id for missing links via estimate_id
UPDATE repair_requests rr
SET work_order_id = wo.id, updated_at = now()
FROM work_orders wo
WHERE wo.estimate_id = rr.estimate_id
  AND rr.work_order_id IS NULL
  AND rr.estimate_id IS NOT NULL;

-- Step 3: Backfill work orders with missing deposit from linked repair requests
UPDATE work_orders wo
SET
  deposit_required = true,
  deposit_amount = rr.deposit_amount,
  deposit_payment_status = 'paid',
  deposit_paid_at = rr.deposit_paid_at,
  deposit_payment_method_type = COALESCE(rr.deposit_payment_method_type, 'card'),
  updated_at = now()
FROM repair_requests rr
WHERE (rr.work_order_id = wo.id OR (rr.estimate_id = wo.estimate_id AND rr.estimate_id IS NOT NULL))
  AND rr.deposit_payment_status = 'paid'
  AND rr.deposit_amount IS NOT NULL
  AND (wo.deposit_payment_status IS NULL OR wo.deposit_payment_status NOT IN ('paid'));

-- Step 4: Backfill estimating_invoices.deposit_applied for invoices where work order
-- has a paid deposit but invoice shows 0 deposit_applied
UPDATE estimating_invoices ei
SET
  deposit_applied = wo.deposit_amount,
  balance_due = GREATEST(0, ei.total_amount - wo.deposit_amount - COALESCE(ei.amount_paid, 0)),
  updated_at = now()
FROM work_orders wo
WHERE ei.work_order_id = wo.id
  AND wo.deposit_payment_status = 'paid'
  AND wo.deposit_amount IS NOT NULL
  AND wo.deposit_amount > 0
  AND (ei.deposit_applied IS NULL OR ei.deposit_applied = 0)
  AND ei.payment_status != 'paid';
