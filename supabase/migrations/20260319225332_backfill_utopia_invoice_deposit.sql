/*
  # Backfill deposit on existing Utopia invoice INV000007

  ## Problem
  INV000007 (WO000009, UTOPIA, $14,934.60) was created before the deposit carry-over
  fix was applied. The Utopia repair request "Spring start up" had a $13,000 deposit
  paid on 3/10/2026, but this was never reflected in the invoice.

  ## Changes
  - Sets deposit_applied = 13000.00 on INV000007
  - The existing DB trigger (trigger_calculate_invoice_balance) will automatically
    recalculate balance_due = total_amount - deposit_applied - amount_paid
*/

UPDATE estimating_invoices
SET deposit_applied = 13000.00
WHERE invoice_number = 'INV000007'
  AND deposit_applied = 0;
