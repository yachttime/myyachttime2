-- Record WO000026 (LOOK AT THAT) deposit payment — $12,000 paid via Stripe
-- The Stripe webhook couldn't update the work order because deposit_payment_status
-- was 'not_required' instead of 'pending', so the webhook's conditional update matched 0 rows.

-- 1. Update the work order to mark the deposit as paid
UPDATE work_orders
SET
  deposit_payment_status = 'paid',
  deposit_paid_at = NOW(),
  deposit_stripe_payment_intent_id = 'pm_1TD2sh3o2gQn156d9M8VHVRF',
  deposit_payment_method_type = 'card',
  updated_at = NOW()
WHERE work_order_number = 'WO000026'
  AND id = '99ba3e74-d8ef-4641-a809-b4438b08c358'
  AND deposit_payment_status != 'paid';

-- 2. Insert the missing deposit payment record
INSERT INTO estimating_payments (
  company_id,
  payment_type,
  work_order_id,
  estimate_id,
  yacht_id,
  amount,
  payment_date,
  payment_method,
  payment_method_type,
  stripe_payment_intent_id,
  is_retail_customer,
  recorded_by,
  notes,
  created_at,
  updated_at
) VALUES (
  '519b4394-d35c-46d7-997c-db7e46178ef5',
  'deposit',
  '99ba3e74-d8ef-4641-a809-b4438b08c358',
  'ecce97b2-68f1-42fb-af2b-8cfac18d2daa',
  '262efc2b-0f57-47d0-8c1d-a855223e49c1',
  12000.00,
  NOW(),
  'stripe',
  'card',
  'pm_1TD2sh3o2gQn156d9M8VHVRF',
  false,
  '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  'Stripe deposit recorded manually — webhook could not match work order (status was not_required instead of pending)',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
