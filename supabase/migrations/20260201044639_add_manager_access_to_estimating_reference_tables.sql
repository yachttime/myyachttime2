/*
  # Add Manager Access to Estimating Reference Tables

  1. Changes
    - Add RLS policies for managers with can_approve_repairs to access:
      - labor_codes (view only - reference data)
      - parts_inventory (view and update for quantity adjustments)
      - accounting_codes (view only - reference data)
      - vendors (view only - reference data)
  
  2. Security
    - Managers must have can_approve_repairs = true
    - Parts inventory allows updates for quantity adjustments
    - Other tables are view-only as they are reference data
*/

-- labor_codes policies (view only)
CREATE POLICY "Managers with repair approval can view labor codes"
  ON labor_codes FOR SELECT
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

-- parts_inventory policies (view and update)
CREATE POLICY "Managers with repair approval can view parts inventory"
  ON parts_inventory FOR SELECT
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

CREATE POLICY "Managers with repair approval can update parts inventory"
  ON parts_inventory FOR UPDATE
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

-- accounting_codes policies (view only)
CREATE POLICY "Managers with repair approval can view accounting codes"
  ON accounting_codes FOR SELECT
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

-- vendors policies (view only)
CREATE POLICY "Managers with repair approval can view vendors"
  ON vendors FOR SELECT
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
