-- Fix Eclipse deck repairs invoice: update amount to $14,502.41 and record both payments
-- Two payments of $7,502.41 each: pm_1TI8fY3o2gQn156dXvKQrhgN and pm_1THtmn3o2gQn156dXmTcyePG
UPDATE yacht_invoices
SET 
  invoice_amount = '$14,502.41',
  invoice_amount_numeric = 14502.41,
  payment_status = 'paid',
  stripe_payment_intent_id = 'pm_1TI8fY3o2gQn156dXvKQrhgN, pm_1THtmn3o2gQn156dXmTcyePG'
WHERE id = 'b3a424ed-d063-42c9-b4a4-cc14e086412e'
  AND repair_title = 'Deck repairs';