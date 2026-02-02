/*
  # Fix Customer Database RLS Policies - Remove Manager Role

  1. Changes
    - Update all RLS policies on customers table to remove 'manager' role
    - Update all RLS policies on customer_vessels table to remove 'manager' role
    - Only staff, mechanic, and master roles will have access

  2. Security
    - Maintains strict access control for customer database
    - Aligns with current role structure (no manager role)
*/

-- Drop existing policies for customers
DROP POLICY IF EXISTS "Staff can view all customers" ON customers;
DROP POLICY IF EXISTS "Staff can insert customers" ON customers;
DROP POLICY IF EXISTS "Staff can update customers" ON customers;
DROP POLICY IF EXISTS "Staff can delete customers" ON customers;

-- Recreate policies without manager role
CREATE POLICY "Staff can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Drop existing policies for customer_vessels
DROP POLICY IF EXISTS "Staff can view all customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can insert customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can update customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff can delete customer vessels" ON customer_vessels;

-- Recreate policies without manager role
CREATE POLICY "Staff can view all customer vessels"
  ON customer_vessels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff can insert customer vessels"
  ON customer_vessels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff can update customer vessels"
  ON customer_vessels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff can delete customer vessels"
  ON customer_vessels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );
