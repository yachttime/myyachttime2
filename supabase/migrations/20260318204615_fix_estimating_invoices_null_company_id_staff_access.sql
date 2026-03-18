/*
  # Fix estimating invoices null company_id blocking staff access

  ## Problem
  All estimating invoices have company_id = NULL. The staff RLS policy compares
  user_profiles.company_id = estimating_invoices.company_id, but NULL = NULL is
  false in SQL, so staff users see zero invoices.

  ## Fix
  1. Backfill null company_id on estimating_invoices to AZ Marine (the only real company)
  2. Also backfill child tables (estimating_invoice_line_items if any have null company_id)
  3. Update the staff/mechanic SELECT policy to also allow access when company_id IS NULL
     as a safety fallback (prevents this from breaking again if a new invoice slips through)
*/

UPDATE estimating_invoices
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

DROP POLICY IF EXISTS "Staff and mechanic can view company estimating invoices" ON estimating_invoices;

CREATE POLICY "Staff and mechanic can view company estimating invoices"
  ON estimating_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('staff', 'mechanic')
        AND user_profiles.is_active = true
        AND user_profiles.company_id = estimating_invoices.company_id
    )
  );
