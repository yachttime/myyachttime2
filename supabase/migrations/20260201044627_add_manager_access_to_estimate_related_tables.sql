/*
  # Add Manager Access to Estimate Related Tables

  1. Changes
    - Add RLS policies for managers with can_approve_repairs to access:
      - estimate_tasks
      - estimate_line_items
      - work_orders
      - work_order_tasks
      - work_order_line_items
  
  2. Security
    - Managers must have can_approve_repairs = true
    - Consistent with estimate access permissions
*/

-- estimate_tasks policies
CREATE POLICY "Managers with repair approval can view estimate tasks"
  ON estimate_tasks FOR SELECT
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

CREATE POLICY "Managers with repair approval can insert estimate tasks"
  ON estimate_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers with repair approval can update estimate tasks"
  ON estimate_tasks FOR UPDATE
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

CREATE POLICY "Managers with repair approval can delete estimate tasks"
  ON estimate_tasks FOR DELETE
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

-- estimate_line_items policies
CREATE POLICY "Managers with repair approval can view estimate line items"
  ON estimate_line_items FOR SELECT
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

CREATE POLICY "Managers with repair approval can insert estimate line items"
  ON estimate_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers with repair approval can update estimate line items"
  ON estimate_line_items FOR UPDATE
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

CREATE POLICY "Managers with repair approval can delete estimate line items"
  ON estimate_line_items FOR DELETE
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

-- work_orders policies
CREATE POLICY "Managers with repair approval can view work orders"
  ON work_orders FOR SELECT
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

CREATE POLICY "Managers with repair approval can insert work orders"
  ON work_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers with repair approval can update work orders"
  ON work_orders FOR UPDATE
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

CREATE POLICY "Managers with repair approval can delete work orders"
  ON work_orders FOR DELETE
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

-- work_order_tasks policies
CREATE POLICY "Managers with repair approval can view work order tasks"
  ON work_order_tasks FOR SELECT
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

CREATE POLICY "Managers with repair approval can insert work order tasks"
  ON work_order_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers with repair approval can update work order tasks"
  ON work_order_tasks FOR UPDATE
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

CREATE POLICY "Managers with repair approval can delete work order tasks"
  ON work_order_tasks FOR DELETE
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

-- work_order_line_items policies
CREATE POLICY "Managers with repair approval can view work order line items"
  ON work_order_line_items FOR SELECT
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

CREATE POLICY "Managers with repair approval can insert work order line items"
  ON work_order_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.can_approve_repairs = true
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers with repair approval can update work order line items"
  ON work_order_line_items FOR UPDATE
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

CREATE POLICY "Managers with repair approval can delete work order line items"
  ON work_order_line_items FOR DELETE
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
