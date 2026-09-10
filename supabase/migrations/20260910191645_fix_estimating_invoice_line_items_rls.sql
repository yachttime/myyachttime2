-- Clean up old master bypass policies on estimating_invoice_line_items
-- These allow masters to see/modify ALL invoice line items regardless of company
DROP POLICY IF EXISTS "Master users can view invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Master users can insert invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Master users can update invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Master users can delete invoice line items" ON estimating_invoice_line_items;

-- Also fix the staff/manager policies to use get_user_company_id() instead of up.company_id
DROP POLICY IF EXISTS "Staff and manager can view company invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Staff and manager can insert company invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Staff and manager can update company invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Staff and manager can delete company invoice line items" ON estimating_invoice_line_items;
DROP POLICY IF EXISTS "Users can view company estimating invoice line items" ON estimating_invoice_line_items;

-- Recreate with proper company filtering via get_user_company_id()
CREATE POLICY "Users can view company estimating invoice line items"
  ON estimating_invoice_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      WHERE ei.id = estimating_invoice_line_items.invoice_id
      AND ei.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Staff can insert company estimating invoice line items"
  ON estimating_invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      WHERE ei.id = estimating_invoice_line_items.invoice_id
      AND ei.company_id = get_user_company_id()
    ) AND is_staff()
  );

CREATE POLICY "Staff can update company estimating invoice line items"
  ON estimating_invoice_line_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      WHERE ei.id = estimating_invoice_line_items.invoice_id
      AND ei.company_id = get_user_company_id()
    ) AND is_staff()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      WHERE ei.id = estimating_invoice_line_items.invoice_id
      AND ei.company_id = get_user_company_id()
    ) AND is_staff()
  );

CREATE POLICY "Staff can delete company estimating invoice line items"
  ON estimating_invoice_line_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      WHERE ei.id = estimating_invoice_line_items.invoice_id
      AND ei.company_id = get_user_company_id()
    ) AND is_staff()
  );
