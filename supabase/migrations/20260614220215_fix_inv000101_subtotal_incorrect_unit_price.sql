-- Fix INV000101: subtotal was incorrectly stored as $150 (unit price) instead of $375 (qty 2.5 × $150)
-- The work order WO000119 has the correct values: subtotal=375, shop_supplies=18.75, park_fees=11.25, surcharge=56.25, total=461.25

UPDATE estimating_invoices
SET
  subtotal = 375.00,
  shop_supplies_amount = 18.75,
  park_fees_amount = 11.25,
  surcharge_amount = 56.25,
  total_amount = 461.25,
  balance_due = CASE
    WHEN deposit_applied > 0 THEN GREATEST(0, 461.25 - deposit_applied)
    ELSE 461.25
  END,
  updated_at = now()
WHERE id = '413155da-9d7b-4c42-a996-d737942695fc';
