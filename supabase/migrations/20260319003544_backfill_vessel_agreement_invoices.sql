/*
  # Backfill missing yacht_invoices for approved vessel management agreements

  Some vessel management agreements were approved before the invoice auto-creation
  logic was added. This migration creates the missing invoices for those agreements.

  Affected yachts: ORION, SOLACE, OBESSION, INTRIGUE, CALYPSO, RHAPSODY, ECLIPSE
*/

INSERT INTO yacht_invoices (
  yacht_id,
  vessel_management_agreement_id,
  invoice_amount,
  invoice_amount_numeric,
  repair_title,
  invoice_year,
  invoice_date,
  completed_by,
  payment_status,
  company_id
)
SELECT
  vma.yacht_id,
  vma.id,
  '$' || vma.grand_total::text,
  vma.grand_total,
  'Vessel Management Agreement – ' || vma.season_name,
  EXTRACT(YEAR FROM vma.approved_at)::int,
  vma.approved_at,
  vma.approved_by,
  'pending',
  '519b4394-d35c-46d7-997c-db7e46178ef5'
FROM vessel_management_agreements vma
LEFT JOIN yacht_invoices yi ON yi.vessel_management_agreement_id = vma.id
WHERE vma.status = 'approved'
  AND yi.id IS NULL;
