/*
# Apply Duplicate Stripe Payment to INV000180 and Close Old Yacht Invoice

## Background
Work order WO000070 (LOVIN LIFE) was paid twice via Stripe:
1. $2,512.87 on ~May 14, 2026 via Stripe PI `pi_3TX2v63o2gQn156d1sGvGTsZ` — recorded as a yacht_invoice (old billing system)
2. $2,881.87 on ~July 1, 2026 via Stripe PI `pi_3ToUGO3o2gQn156d12rMBLhA` — recorded as INV000064 (estimating system)

The $2,512.87 payment was incorrectly captured by the old yacht invoice system instead of
being applied to the estimating invoice. This migration moves that payment to INV000180
(another LOVIN LIFE estimating invoice that was unpaid) and marks the old yacht invoice
as "refunded" (the closest allowed status) with Stripe IDs cleared so it no longer
shows as an active Stripe-paid invoice.

## Changes
1. Insert a new estimating_payments record for $2,512.87 linked to INV000180
   - payment_type: 'final_payment'
   - payment_method: 'stripe'
   - payment_method_type: 'card' (constraint allows only 'card' or 'ach')
   - stripe_payment_intent_id: pi_3TX2v63o2gQn156d1sGvGTsZ
   - stripe_checkout_session_id: plink_1TWOg83o2gQn156d6WBfW7V7
   - payment_date: 2026-05-14
   - recorded_by: jeff Stanley (user_id 610f94b4-646f-4f5b-b64a-a47723f6e85e)
   - notes: documents the transfer from the old yacht invoice
2. Update INV000180: amount_paid = 2512.87, payment_status = 'partial'
3. Update the old yacht invoice (78c77d3a-c905-4b4e-871b-4e46a54b5f83):
   - payment_status = 'refunded' (closest allowed value; payment moved to estimating invoice)
   - Clear stripe_payment_intent_id and stripe_checkout_session_id

## Security
No RLS policy changes. Data-only migration.
*/

-- Step 1: Insert the payment record into estimating_payments
INSERT INTO estimating_payments (
  company_id,
  payment_type,
  work_order_id,
  invoice_id,
  yacht_id,
  customer_name,
  amount,
  payment_date,
  payment_method,
  payment_method_type,
  stripe_payment_intent_id,
  stripe_checkout_session_id,
  reference_number,
  recorded_by,
  notes
) VALUES (
  '519b4394-d35c-46d7-997c-db7e46178ef5',
  'final_payment',
  '2ccdbc93-f81e-43bc-81fe-8c41ef04eca6',
  'ff0f34e6-cc01-458f-bd7f-d102933d447d',
  '53127893-91f9-49f7-b62a-3cea575d9ebe',
  'LOVIN LIFE',
  2512.87,
  '2026-05-14',
  'stripe',
  'card',
  'pi_3TX2v63o2gQn156d1sGvGTsZ',
  'plink_1TWOg83o2gQn156d6WBfW7V7',
  'pi_3TX2v63o2gQn156d1sGvGTsZ',
  '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  'Transferred from old yacht invoice 78c77d3a. This Stripe payment was originally captured by the yacht_invoices system for WO000070 (LOVIN LIFE) and is being applied to INV000180 to correct the duplicate billing.'
);

-- Step 2: Update INV000180 to reflect the partial payment
UPDATE estimating_invoices
SET amount_paid = 2512.87,
    payment_status = 'partial'
WHERE id = 'ff0f34e6-cc01-458f-bd7f-d102933d447d';

-- Step 3: Mark the old yacht invoice as refunded with Stripe IDs cleared
UPDATE yacht_invoices
SET payment_status = 'refunded',
    stripe_payment_intent_id = NULL,
    stripe_checkout_session_id = NULL
WHERE id = '78c77d3a-c905-4b4e-871b-4e46a54b5f83';
