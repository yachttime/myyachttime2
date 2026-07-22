/*
# Fix invoices with negative balance_due from deposit double-counting

## Problem
Several invoices have negative balance_due values caused by the deposit being
counted twice — once as `deposit_applied` and once as `amount_paid`.

## Affected Invoices and Fixes

### Deposit double-count (amount_paid includes deposit that's also in deposit_applied)
- **INV000178**: deposit_applied=$14,000, amount_paid=$14,000 (all deposit) → amount_paid=0, balance=$13,163.82, status=unpaid
- **INV000142**: deposit_applied=$9,229.02, amount_paid=$9,229.02 (all deposit) → amount_paid=0, balance=$0.00 (deposit exceeds total), status=paid
- **INV000042**: deposit_applied=$9,379.15, amount_paid=$11,007.74 (includes deposit + $3,150 check) → amount_paid=$3,150, balance=$3,928.87, status=unpaid

### Genuine overpayments (no deposit, just amount_paid > total)
- **INV000040**: amount_paid=$6,051.94 > total=$5,875.67 → balance=0 (keep as paid)
- **INV000114**: amount_paid=$4,074.80 > total=$2,037.40 → balance=0 (keep as paid)
- **INV000115**: amount_paid=$22,432.89 > total=$21,779.50 → balance=0 (keep as paid)

## Important Notes
1. For INV000178 and INV000142, the estimating_payments deposit rows are linked to
   the invoice via invoice_id. The deposit is already tracked via deposit_applied,
   so amount_paid should NOT include deposit amounts.
2. For INV000042, the deposit was baked into amount_paid during conversion but
   there's no deposit-type estimating_payments row — the $3,150 check payment is
   the only real non-deposit payment.
3. For the genuine overpayments, balance is clamped to 0 and payment_status stays 'paid'.
4. The calculate_invoice_balance trigger (fixed in prior migration) now uses
   GREATEST(0, ...) so these negative balances can never recur.
*/

-- Fix INV000178: deposit double-counted in amount_paid
UPDATE estimating_invoices
SET
  amount_paid = 0,
  balance_due = GREATEST(0, total_amount - deposit_applied - 0),
  payment_status = CASE WHEN (total_amount - deposit_applied) <= 0 THEN 'paid' ELSE 'unpaid' END,
  paid_at = CASE WHEN (total_amount - deposit_applied) <= 0 THEN paid_at ELSE NULL END,
  final_payment_paid_at = CASE WHEN (total_amount - deposit_applied) <= 0 THEN final_payment_paid_at ELSE NULL END,
  final_payment_stripe_payment_intent_id = CASE WHEN (total_amount - deposit_applied) <= 0 THEN final_payment_stripe_payment_intent_id ELSE NULL END,
  final_payment_method_type = CASE WHEN (total_amount - deposit_applied) <= 0 THEN final_payment_method_type ELSE NULL END,
  updated_at = now()
WHERE invoice_number = 'INV000178';

-- Fix INV000142: deposit double-counted (deposit exceeds total, so it's actually paid)
UPDATE estimating_invoices
SET
  amount_paid = 0,
  balance_due = GREATEST(0, total_amount - deposit_applied - 0),
  payment_status = 'paid',
  updated_at = now()
WHERE invoice_number = 'INV000142';

-- Fix INV000042: deposit was baked into amount_paid, only $3,150 check is real payment
UPDATE estimating_invoices
SET
  amount_paid = 3150.00,
  balance_due = GREATEST(0, total_amount - deposit_applied - 3150.00),
  payment_status = CASE WHEN (total_amount - deposit_applied - 3150.00) <= 0 THEN 'paid' ELSE 'unpaid' END,
  paid_at = CASE WHEN (total_amount - deposit_applied - 3150.00) <= 0 THEN paid_at ELSE NULL END,
  final_payment_paid_at = CASE WHEN (total_amount - deposit_applied - 3150.00) <= 0 THEN final_payment_paid_at ELSE NULL END,
  final_payment_stripe_payment_intent_id = CASE WHEN (total_amount - deposit_applied - 3150.00) <= 0 THEN final_payment_stripe_payment_intent_id ELSE NULL END,
  final_payment_method_type = CASE WHEN (total_amount - deposit_applied - 3150.00) <= 0 THEN final_payment_method_type ELSE NULL END,
  updated_at = now()
WHERE invoice_number = 'INV000042';

-- Fix genuine overpayments: clamp balance to 0, keep as paid
UPDATE estimating_invoices
SET
  balance_due = 0,
  updated_at = now()
WHERE invoice_number IN ('INV000040', 'INV000114', 'INV000115')
  AND balance_due < 0;
