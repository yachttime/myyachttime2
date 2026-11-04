/*
# Apply 20% discount before sales tax on INV000272

1. Changes
- INV000272 (estimating invoice) gets a 20% discount ($116.12) taken off the subtotal before sales tax.
- Sales tax is recalculated on the discounted taxable amount: $143.10 x 0.80 = $114.48 x 9.9% = $11.33.
- Shop supplies stay at the amount already billed ($29.03).
- New invoice total: $464.48 + $29.03 + $11.33 = $504.84 (was $623.80).
- Balance due is set to the new total because the invoice is unpaid.
- WO000286 (the work order it came from) gets the 20% discount and matching tax and total so the records agree.

2. Security
- No access or policy changes.

3. Notes
- Only updates the row if the invoice is still unpaid and has no payments applied.
*/

UPDATE estimating_invoices
SET discount_percentage = 20,
    discount_amount = 116.12,
    tax_amount = 11.33,
    total_amount = 504.84,
    balance_due = 504.84
WHERE id = '704b4101-57f6-4768-84fe-ea332f05d883'
  AND COALESCE(amount_paid, 0) = 0
  AND COALESCE(deposit_applied, 0) = 0;

UPDATE work_orders
SET discount = 0.20,
    sales_tax_amount = 11.33,
    total_amount = 504.84
WHERE id = 'b5e0198a-6a02-4709-9fa9-49a9425ac40b'
  AND COALESCE(discount, 0) = 0;
