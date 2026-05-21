/*
  # Mark WO000037 as completed

  Work is done on EST000026 / WO000037 (INTRIGUE - Dekit).
  Final payment received via Stripe, invoice INV000066 created and paid.
*/

UPDATE work_orders
SET status = 'completed',
    completed_at = '2026-03-04 00:00:00+00',
    updated_at = now()
WHERE id = '0e43d1df-0b64-4332-9257-21b71ce1d9dd';
