/*
  # Backfill Invoice Discount Fields from Linked Estimates

  ## Summary
  Updates existing estimating_invoices that are missing discount values
  but have a linked estimate with a discount applied. This ensures the
  discount_percentage and discount_amount fields are populated so the
  invoice detail view and PDF correctly display the discount line item.

  ## Changes
  - Updates discount_percentage and discount_amount on estimating_invoices
    where the linked estimate has a discount but the invoice does not
*/

UPDATE estimating_invoices ei
SET
  discount_percentage = e.discount_percentage,
  discount_amount = e.discount_amount
FROM estimates e
WHERE ei.estimate_id = e.id
  AND e.discount_amount > 0
  AND (ei.discount_amount IS NULL OR ei.discount_amount = 0);
