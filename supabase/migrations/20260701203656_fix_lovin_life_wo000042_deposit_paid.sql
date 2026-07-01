-- Fix WO000042 (LOVIN LIFE) deposit status — was paid via Stripe/card on 2026-03-02 but status was incorrectly set to not_required
UPDATE work_orders
SET deposit_payment_status = 'paid'
WHERE work_order_number = 'WO000042'
  AND id = '5a77a990-c426-4d5c-bb57-a62fa1749b04';

-- Insert the missing deposit payment record
INSERT INTO estimating_payments (
  company_id,
  payment_type,
  work_order_id,
  yacht_id,
  amount,
  payment_method,
  payment_method_type,
  customer_name,
  recorded_by,
  notes,
  created_at
) VALUES (
  '519b4394-d35c-46d7-997c-db7e46178ef5',
  'deposit',
  '5a77a990-c426-4d5c-bb57-a62fa1749b04',
  '53127893-91f9-49f7-b62a-3cea575d9ebe',
  6500.00,
  'stripe',
  'card',
  'Verl Workman',
  '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  'Stripe deposit — Amex ending 8041 — $6,500 paid, net $6,311.20 after fees',
  '2026-03-02 19:15:49.408+00'
);
