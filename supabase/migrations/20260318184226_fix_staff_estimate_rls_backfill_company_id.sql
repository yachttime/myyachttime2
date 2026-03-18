/*
  # Fix Staff Estimate RLS - Backfill company_id and update policies

  ## Problem
  Old estimate_tasks and estimate_line_items rows have NULL company_id.
  Staff RLS policies check company_id equality, so staff cannot delete/update
  these old rows when editing an estimate.

  ## Changes
  1. Backfill company_id on estimate_tasks from parent estimates table
  2. Backfill company_id on estimate_line_items from parent estimates table
  3. Drop and recreate staff DELETE policies on both tables to handle NULL company_id
     by falling back to the parent estimate's company_id
*/

-- Backfill estimate_tasks company_id from parent estimate
UPDATE estimate_tasks
SET company_id = estimates.company_id
FROM estimates
WHERE estimate_tasks.estimate_id = estimates.id
  AND estimate_tasks.company_id IS NULL
  AND estimates.company_id IS NOT NULL;

-- Backfill estimate_line_items company_id from parent estimate
UPDATE estimate_line_items
SET company_id = estimates.company_id
FROM estimates
WHERE estimate_line_items.estimate_id = estimates.id
  AND estimate_line_items.company_id IS NULL
  AND estimates.company_id IS NOT NULL;

-- Drop and recreate staff DELETE policy on estimate_tasks to handle NULL company_id
DROP POLICY IF EXISTS "Staff can delete company estimate tasks" ON estimate_tasks;

CREATE POLICY "Staff can delete company estimate tasks"
  ON estimate_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND up.is_active = true
        AND up.company_id = COALESCE(
          estimate_tasks.company_id,
          (SELECT e.company_id FROM estimates e WHERE e.id = estimate_tasks.estimate_id)
        )
    )
  );

-- Drop and recreate staff DELETE policy on estimate_line_items to handle NULL company_id
DROP POLICY IF EXISTS "Staff and mechanic can delete company estimate line items" ON estimate_line_items;

CREATE POLICY "Staff and mechanic can delete company estimate line items"
  ON estimate_line_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND up.is_active = true
        AND up.company_id = COALESCE(
          estimate_line_items.company_id,
          (SELECT e.company_id FROM estimates e WHERE e.id = estimate_line_items.estimate_id)
        )
    )
  );

-- Also update the UPDATE policies similarly to handle null company_id
DROP POLICY IF EXISTS "Staff and mechanic can update company estimate line items" ON estimate_line_items;

CREATE POLICY "Staff and mechanic can update company estimate line items"
  ON estimate_line_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
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
        AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND up.is_active = true
        AND up.company_id = COALESCE(
          estimate_line_items.company_id,
          (SELECT e.company_id FROM estimates e WHERE e.id = estimate_line_items.estimate_id)
        )
    )
  );

DROP POLICY IF EXISTS "Staff can update company estimate tasks" ON estimate_tasks;

CREATE POLICY "Staff can update company estimate tasks"
  ON estimate_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
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
        AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role])
        AND up.is_active = true
        AND up.company_id = COALESCE(
          estimate_tasks.company_id,
          (SELECT e.company_id FROM estimates e WHERE e.id = estimate_tasks.estimate_id)
        )
    )
  );
