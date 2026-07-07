
-- Mark Allure INV000112 ($21,040.34) as paid via Stripe card
-- Stripe payment method: pm_1Tpx7P3o2gQn156dN9wxCapz
UPDATE estimating_invoices
SET payment_status = 'paid',
    paid_at = NOW(),
    final_payment_paid_at = NOW(),
    amount_paid = 21040.34,
    final_payment_method_type = 'card',
    updated_at = NOW()
WHERE id = '14f17a55-430c-495d-b28d-325b994139c7'
  AND invoice_number = 'INV000112'
  AND payment_status = 'unpaid';
