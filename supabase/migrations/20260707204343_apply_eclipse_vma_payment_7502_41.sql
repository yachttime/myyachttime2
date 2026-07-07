-- Apply $7,000 payment (pm_1T5aOJ3o2gQn156dQjv9akJa) plus $502.41 deck repairs credit
-- to Eclipse's vessel management agreement invoice ($13,950.00)
-- Total applied: $7,502.41, remaining balance: $6,447.59
UPDATE yacht_invoices
SET 
  stripe_payment_intent_id = 'pm_1T5aOJ3o2gQn156dQjv9akJa',
  credit_amount = 7502.41,
  payment_status = 'partial'
WHERE id = 'aea91723-f367-4dff-9c05-4146095fa362'
  AND yacht_id = '690eeade-7ffe-4d36-9667-3b3dd3dcdb46'
  AND invoice_amount_numeric = 13950;