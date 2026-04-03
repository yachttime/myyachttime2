/*
  # Add Staff/Manager Access to Estimating Invoice Line Items

  ## Summary
  The estimating_invoice_line_items table previously only allowed master users
  to insert, update, and delete. This migration adds the same access for staff
  and manager roles, scoped to their company.

  ## Changes
  - Add SELECT policy for staff and manager roles
  - Add INSERT policy for staff and manager roles
  - Add UPDATE policy for staff and manager roles
  - Add DELETE policy for staff and manager roles
*/

CREATE POLICY "Staff and manager can view company invoice line items"
  ON estimating_invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      JOIN user_profiles up ON up.user_id = auth.uid()
      WHERE ei.id = estimating_invoice_line_items.invoice_id
        AND up.role IN ('staff', 'manager')
        AND up.is_active = true
        AND up.company_id = ei.company_id
    )
  );

CREATE POLICY "Staff and manager can insert company invoice line items"
  ON estimating_invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      JOIN user_profiles up ON up.user_id = auth.uid()
      WHERE ei.id = estimating_invoice_line_items.invoice_id
        AND up.role IN ('staff', 'manager')
        AND up.is_active = true
        AND up.company_id = ei.company_id
    )
  );

CREATE POLICY "Staff and manager can update company invoice line items"
  ON estimating_invoice_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      JOIN user_profiles up ON up.user_id = auth.uid()
      WHERE ei.id = estimating_invoice_line_items.invoice_id
        AND up.role IN ('staff', 'manager')
        AND up.is_active = true
        AND up.company_id = ei.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      JOIN user_profiles up ON up.user_id = auth.uid()
      WHERE ei.id = estimating_invoice_line_items.invoice_id
        AND up.role IN ('staff', 'manager')
        AND up.is_active = true
        AND up.company_id = ei.company_id
    )
  );

CREATE POLICY "Staff and manager can delete company invoice line items"
  ON estimating_invoice_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimating_invoices ei
      JOIN user_profiles up ON up.user_id = auth.uid()
      WHERE ei.id = estimating_invoice_line_items.invoice_id
        AND up.role IN ('staff', 'manager')
        AND up.is_active = true
        AND up.company_id = ei.company_id
    )
  );
