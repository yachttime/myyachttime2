/*
  # Add Manager Access to Estimate Settings and Company Info

  1. Changes
    - Add RLS policies for managers with can_approve_repairs to access:
      - estimate_settings (view and update for tax rates)
      - company_info (view only for company details on estimates)
  
  2. Security
    - Managers must have can_approve_repairs = true
    - Consistent with estimate access permissions
*/

-- estimate_settings policies
CREATE POLICY "Managers with repair approval can view estimate settings"
  ON estimate_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers with repair approval can update estimate settings"
  ON estimate_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

-- company_info policies (view only)
CREATE POLICY "Managers with repair approval can view company info"
  ON company_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );
