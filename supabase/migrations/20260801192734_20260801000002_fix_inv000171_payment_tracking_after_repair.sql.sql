/*
  # Fix INV000171 Payment Tracking After Totals Repair

  ## Problem
  The previous data repair migration (fix_invoice_totals_race_condition_data_repair)
  recalculated INV000171's total_amount from $1,990.70 to $3,889.50 (the correct value).
  However, it overwrote amount_paid to 0 because the Stripe ACH payment of $1,990.70
  was tracked through the invoice's final_payment_* fields, not through
  estimating_payments records.

  ## Fix
  Restore amount_paid to $1,990.70 (the Stripe payment that was already received),
  set payment_status to 'partial' (since the correct total exceeds the amount paid),
  and recalculate balance_due as $3,889.50 - $1,990.70 = $1,898.80.

  ## Important Notes
  1. The customer was undercharged by $1,898.80 due to the original race condition bug.
  2. The Stripe payment of $1,990.70 was real and must be preserved.
  3. The invoice moves from "paid" to "partial" status — the customer owes an
     additional $1,898.80.
*/
UPDATE estimating_invoices SET
  amount_paid = 1990.70,
  balance_due = 3889.50 - 1990.70,
  payment_status = 'partial',
  updated_at = now()
WHERE invoice_number = 'INV000171';