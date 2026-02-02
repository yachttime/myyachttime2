/*
  # Add Manager Role to Customer Database Access

  1. Changes
    - Add 'manager' role to all customer database policies
    - Managers can view, insert, update, and delete customers and customer vessels
  
  2. Security
    - Maintains RLS on all tables
    - Only authenticated users with manager, staff, mechanic, or master roles can access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view all customers" ON customers;
DROP POLICY IF EXISTS "Staff can insert customers" ON customers;
DROP POLICY IF EXISTS "Staff can update customers" ON customers;
DROP POLICY IF EXISTS "Staff can delete customers" ON customers;

DROP POLICY IF EXISTS "Staff can view all customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can insert customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can update customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can delete customer vessels" ON customer_vessels;

-- Create new policies with manager role included
CREATE POLICY "Staff and managers can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can view all customer vessels"
  ON customer_vessels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can insert customer vessels"
  ON customer_vessels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can update customer vessels"
  ON customer_vessels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and managers can delete customer vessels"
  ON customer_vessels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );
