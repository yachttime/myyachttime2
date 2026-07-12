
-- Reset TRADITIONS VMA invoice from incorrect "processing" status back to pending
-- No payment was actually processed in Stripe
UPDATE yacht_invoices 
SET payment_status = 'pending',
    stripe_checkout_session_id = NULL,
    payment_method_type = NULL,
    payment_link_url = NULL
WHERE id = 'be04b879-314a-464c-bc45-1a5985fc9294';
