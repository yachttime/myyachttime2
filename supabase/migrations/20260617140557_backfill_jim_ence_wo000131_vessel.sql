-- Backfill vessel for Jim Ence WO000131 and its source estimate
UPDATE work_orders
SET vessel_id = '6f791d19-ba48-4b27-94cb-b8256639760c', updated_at = NOW()
WHERE id = '4b40ed96-dfb3-4e4f-b258-270931e06517'
  AND work_order_number = 'WO000131';

UPDATE estimates
SET customer_vessel_id = '6f791d19-ba48-4b27-94cb-b8256639760c', updated_at = NOW()
WHERE id = '8385e8bb-90c2-4fc1-9f50-5241d0173133'
  AND customer_name = 'JIM ENCE';
