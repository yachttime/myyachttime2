-- Create the missing yacht_invoice for Athena's approved VMA.
-- The agreement was marked approved but the invoice was never created.

-- First, set approved_at on the agreement since it was NULL
UPDATE vessel_management_agreements
SET approved_at = '2026-06-11 23:33:22+00'
WHERE id = '18824576-aa74-45ad-ad3d-d16bde6ee4d7'
  AND status = 'approved'
  AND approved_at IS NULL;

-- Create the corresponding invoice (matching the pattern of other VMA invoices)
INSERT INTO yacht_invoices (
  yacht_id,
  vessel_management_agreement_id,
  invoice_amount,
  invoice_amount_numeric,
  repair_title,
  invoice_year,
  invoice_date,
  payment_status,
  company_id
) VALUES (
  'b30555e7-e631-49cd-9542-e82f13a7c716',
  '18824576-aa74-45ad-ad3d-d16bde6ee4d7',
  '$11150.00',
  11150.00,
  'Vessel Management Agreement – Annual 2026',
  2026,
  now(),
  'pending',
  '519b4394-d35c-46d7-997c-db7e46178ef5'
);