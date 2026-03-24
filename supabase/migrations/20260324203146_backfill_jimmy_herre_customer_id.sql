/*
  # Backfill customer_id for JIMMY HERRE records

  Links existing estimates, work orders, and repair requests that were
  created with customer_name = 'JIMMY HERRE' but no customer_id back
  to the correct customer record so the Activity Summary displays correctly.
*/

UPDATE estimates
SET customer_id = '31b05e16-5392-4dd7-a923-936a1c569ce1'
WHERE LOWER(customer_name) = 'jimmy herre' AND customer_id IS NULL;

UPDATE work_orders
SET customer_id = '31b05e16-5392-4dd7-a923-936a1c569ce1'
WHERE LOWER(customer_name) = 'jimmy herre' AND customer_id IS NULL;

UPDATE repair_requests
SET customer_id = '31b05e16-5392-4dd7-a923-936a1c569ce1'
WHERE LOWER(customer_name) = 'jimmy herre' AND customer_id IS NULL;
