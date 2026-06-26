
CREATE POLICY "Manager can view estimating invoices for their yacht"
  ON estimating_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'manager'
        AND user_profiles.is_active = true
        AND user_profiles.yacht_id = estimating_invoices.yacht_id
    )
  );
