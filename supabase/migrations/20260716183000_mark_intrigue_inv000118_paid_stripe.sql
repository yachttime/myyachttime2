UPDATE estimating_invoices
SET payment_status = 'paid',
    paid_at = NOW(),
    final_payment_paid_at = NOW(),
    final_payment_stripe_payment_intent_id = 'pm_1TmkAy3o2gQn156d9uPEFnXd',
    payment_method_type = 'card',
    balance_due = 0
WHERE id = '6704b636-8b76-45e3-9aae-5c9824ed5df4'
  AND invoice_number = 'INV000118';
