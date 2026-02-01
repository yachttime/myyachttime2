/*
  # Fix yacht_invoices RLS policies

  1. Security Changes
    - Add SELECT policy for yacht_invoices allowing:
      - MASTER: Can view all invoices
      - Staff/Mechanic: Can view all invoices  
      - Manager: Can view invoices for their assigned yacht
      - Owner: Can view invoices for their yacht
    - Add INSERT policy allowing staff/mechanic/master to create invoices
    - Add UPDATE policy allowing staff/mechanic/master to update invoices
    - Add DELETE policy allowing master to delete invoices

  2. Notes
    - This fixes the issue where users couldn't see payment/invoice data in repair requests
    - RLS was enabled but no policies existed, blocking all access
*/

-- Drop any existing policies first
DROP POLICY IF EXISTS "yacht_invoices_select_policy" ON yacht_invoices;
DROP POLICY IF EXISTS "yacht_invoices_insert_policy" ON yacht_invoices;
DROP POLICY IF EXISTS "yacht_invoices_update_policy" ON yacht_invoices;
DROP POLICY IF EXISTS "yacht_invoices_delete_policy" ON yacht_invoices;

-- SELECT policy: Staff/Mechanic/Master see all, Manager/Owner see their yacht's invoices
CREATE POLICY "yacht_invoices_select_policy"
  ON yacht_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND (
        user_profiles.role IN ('staff', 'mechanic', 'master')
        OR (
          user_profiles.role = 'manager'
          AND user_profiles.yacht_id = yacht_invoices.yacht_id
        )
        OR (
          user_profiles.role = 'owner'
          AND user_profiles.yacht_id = yacht_invoices.yacht_id
        )
      )
    )
  );

-- INSERT policy: Staff/Mechanic/Master can create invoices
CREATE POLICY "yacht_invoices_insert_policy"
  ON yacht_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- UPDATE policy: Staff/Mechanic/Master can update invoices
CREATE POLICY "yacht_invoices_update_policy"
  ON yacht_invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- DELETE policy: Master can delete invoices
CREATE POLICY "yacht_invoices_delete_policy"
  ON yacht_invoices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );
