/*
# Match INV000272 shop supplies and total to the approved estimate EST000329

1. Problem
- INV000272 used shop supplies of 29.03, calculated on the undiscounted subtotal.
- The approved estimate EST000329 uses 23.22, calculated on the discounted subtotal (580.60 - 20% = 464.48).

2. Changes
- estimating_invoices INV000272: shop_supplies_amount 23.22, total_amount and balance_due 499.04.
- work_orders WO000286: shop_supplies_amount 23.22, total_amount 499.04.

3. Safety
- Only updates the rows if the invoice is still unpaid with no deposit applied, and the work order still has the 20% discount.
- No table, policy or grant changes.
*/

UPDATE estimating_invoices
SET shop_supplies_amount = 23.22,
total_amount = 499.04,
balance_due = 499.04,
updated_at = now()
WHERE id = '704b4101-57f6-4768-84fe-ea332f05d883'
AND payment_status = 'unpaid'
AND COALESCE(amount_paid, 0) = 0
AND COALESCE(deposit_applied, 0) = 0
AND shop_supplies_amount = 29.03;

UPDATE work_orders
SET shop_supplies_amount = 23.22,
total_amount = 499.04,
updated_at = now()
WHERE id = 'b5e0198a-6a02-4709-9fa9-49a9425ac40b'
AND discount = 0.20
AND shop_supplies_amount = 29.03;
