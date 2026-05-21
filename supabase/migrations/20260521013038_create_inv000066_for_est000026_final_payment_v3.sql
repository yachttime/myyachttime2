/*
  # Create Invoice INV000066 for EST000026 / WO000037 with Final Payment Applied

  ## Summary
  - Creates estimating invoice INV000066 for yacht INTRIGUE linked to WO000037 / EST000026
  - Total: $16,506.60, Deposit applied: $8,300.00, Balance due: $8,206.60
  - Second Stripe payment pi_3T7Gs43o2gQn156d0D9rWRyE ($8,300, Mar 4 2026) recorded
    as the final payment — invoice marked paid
  - First payment pi_3T6kD43o2gQn156d19uk2kFW was the deposit already on the repair request
  - The $93.40 overpayment (8300 - 8206.60) is noted via balance_due = 0 and amount_paid = 8300
*/

INSERT INTO estimating_invoices (
  invoice_number,
  work_order_id,
  estimate_id,
  yacht_id,
  customer_name,
  is_retail_customer,
  company_id,
  created_by,
  invoice_date,
  subtotal,
  tax_rate,
  tax_amount,
  shop_supplies_amount,
  park_fees_amount,
  surcharge_amount,
  total_amount,
  deposit_applied,
  amount_paid,
  payment_status,
  final_payment_stripe_payment_intent_id,
  final_payment_paid_at,
  final_payment_method_type
)
VALUES (
  'INV000066',
  '0e43d1df-0b64-4332-9257-21b71ce1d9dd',
  '3ef22b3a-bbc1-4fe4-82f7-688b4c87ee30',
  '2e64a5f6-6707-4f38-9546-6bcf22e549cb',
  'INTRIGUE',
  false,
  '519b4394-d35c-46d7-997c-db7e46178ef5',
  '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  '2026-03-04',
  13420.00,
  0.0990,
  0.00,
  671.00,
  402.60,
  2013.00,
  16506.60,
  8300.00,
  8300.00,
  'paid',
  'pi_3T7Gs43o2gQn156d0D9rWRyE',
  '2026-03-04 00:00:00+00',
  'card'
);
