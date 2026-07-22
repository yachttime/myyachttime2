-- Record Aquarius WO000162 deposit payment (Stripe pm_1Tos9L3o2gQn156dS2DUfTqn)
-- The $14,000 deposit was paid via Stripe but never recorded in the system.

UPDATE work_orders
SET
  deposit_payment_status = 'paid',
  deposit_paid_at = NOW(),
  deposit_stripe_payment_intent_id = 'pm_1Tos9L3o2gQn156dS2DUfTqn',
  updated_at = NOW()
WHERE work_order_number = 'WO000162'
  AND deposit_payment_status != 'paid';

INSERT INTO estimating_payments (
  payment_type,
  work_order_id,
  estimate_id,
  amount,
  payment_date,
  payment_method,
  payment_method_type,
  stripe_payment_intent_id,
  company_id,
  recorded_by,
  created_at,
  updated_at
)
SELECT
  'deposit',
  w.id,
  w.estimate_id,
  w.deposit_amount,
  NOW(),
  'stripe',
  'ach',
  'pm_1Tos9L3o2gQn156dS2DUfTqn',
  w.company_id,
  '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  NOW(),
  NOW()
FROM work_orders w
WHERE w.work_order_number = 'WO000162'
  AND NOT EXISTS (
    SELECT 1 FROM estimating_payments ep
    WHERE ep.work_order_id = w.id
      AND ep.payment_type = 'deposit'
      AND ep.stripe_payment_intent_id = 'pm_1Tos9L3o2gQn156dS2DUfTqn'
  );
