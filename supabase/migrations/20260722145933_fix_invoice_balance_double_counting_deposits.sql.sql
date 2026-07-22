/*
# Fix invoice balance double-counting of deposits

## Problem
When a work order with a paid deposit is converted to an invoice, the $14,000 deposit
is counted TWICE in the balance calculation:
1. As `deposit_applied` (from the work order's deposit fields)
2. As `amount_paid` (from the estimating_payments sum, which includes the deposit row)

This produces a negative balance_due (shown as an "overpayment") and incorrectly marks
the invoice as paid.

## Changes

### 1. Fix `calculate_invoice_balance` trigger function
- Wrap the balance calculation in `GREATEST(0, ...)` so negative balances can never
  be stored, even if deposit_applied + amount_paid exceeds total_amount.

### 2. Fix `convert_work_order_to_invoice` function (2-arg version)
- When summing estimating_payments for `v_total_paid`, EXCLUDE rows where
  `payment_type = 'deposit'` — those are already captured in `deposit_applied`.
- This prevents the deposit from being subtracted twice.

### 3. Fix `convert_work_order_to_invoice` function (1-arg version)
- Same fix: exclude deposit-type payments from the amount_paid sum when calculating
  balance and payment status. This version doesn't currently set deposit_applied but
  the safety fix is applied for consistency.

## Important Notes
1. The trigger fix is a safety net — it prevents any negative balance from ever
   being stored, regardless of how the data gets there.
2. The function fix is the root cause fix — it prevents the double-counting at the
   source by excluding deposit payments from the "amount already paid" sum.
3. Data fixes for affected invoices (INV000178 and others) will be applied in a
   separate migration.
*/
