/*
# Fix estimate_tasks and estimate_line_items RLS to allow owner role

## Problem
Same as the estimates table fix: the INSERT/UPDATE/DELETE policies on
estimate_tasks and estimate_line_items only allow staff, mechanic, and master roles.
Owners get "new row violates row-level security policy" when trying to save
estimate tasks and line items.

## Fix
Add 'owner' to the role arrays in the WITH CHECK and USING clauses for
the staff INSERT, UPDATE, and DELETE policies on both tables.

## Tables Modified
1. estimate_tasks - INSERT, UPDATE, DELETE policies
2. estimate_line_items - INSERT, UPDATE, DELETE policies
*/

-- ===== estimate_tasks =====

DROP POLICY IF EXISTS "Staff can insert company estimate tasks" ON estimate_tasks;
CREATE POLICY "Staff can insert company estimate tasks"
  ON estimate_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'owner')
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimate_tasks.company_id
    )
  );

DROP POLICY IF EXISTS "Staff can update company estimate tasks" ON estimate_tasks;
CREATE POLICY "Staff can update company estimate tasks"
  ON estimate_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'owner')
      AND up.is_active = true
      AND up.company_id = COALESCE(
        estimate_tasks.company_id,
        (SELECT e.company_id FROM estimates e WHERE e.id = estimate_tasks.estimate_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'owner')
      AND up.is_active = true
      AND up.company_id = COALESCE(
        estimate_tasks.company_id,
        (SELECT e.company_id FROM estimates e WHERE e.id = estimate_tasks.estimate_id)
      )
    )
  );

DROP POLICY IF EXISTS "Staff can delete company estimate tasks" ON estimate_tasks;
CREATE POLICY "Staff can delete company estimate tasks"
  ON estimate_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'owner')
      AND up.is_active = true
      AND up.company_id = COALESCE(
        estimate_tasks.company_id,
        (SELECT e.company_id FROM estimates e WHERE e.id = estimate_tasks.estimate_id)
      )
    )
  );

-- ===== estimate_line_items =====

DROP POLICY IF EXISTS "Staff and mechanic can insert company estimate line items" ON estimate_line_items;
CREATE POLICY "Staff and mechanic can insert company estimate line items"
  ON estimate_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'owner')
      AND user_profiles.is_active = true
      AND user_profiles.company_id = estimate_line_items.company_id
    )
  );

DROP POLICY IF EXISTS "Staff and mechanic can update company estimate line items" ON estimate_line_items;
CREATE POLICY "Staff and mechanic can update company estimate line items"
  ON estimate_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'owner')
      AND up.is_active = true
      AND up.company_id = COALESCE(
        estimate_line_items.company_id,
        (SELECT e.company_id FROM estimates e WHERE e.id = estimate_line_items.estimate_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'owner')
      AND up.is_active = true
      AND up.company_id = COALESCE(
        estimate_line_items.company_id,
        (SELECT e.company_id FROM estimates e WHERE e.id = estimate_line_items.estimate_id)
      )
    )
  );

DROP POLICY IF EXISTS "Staff and mechanic can delete company estimate line items" ON estimate_line_items;
CREATE POLICY "Staff and mechanic can delete company estimate line items"
  ON estimate_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'owner')
      AND up.is_active = true
      AND up.company_id = COALESCE(
        estimate_line_items.company_id,
        (SELECT e.company_id FROM estimates e WHERE e.id = estimate_line_items.estimate_id)
      )
    )
  );
