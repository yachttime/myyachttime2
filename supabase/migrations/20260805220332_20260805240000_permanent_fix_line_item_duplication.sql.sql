/*
  # Permanently Fix Recurring Line Item Duplication

  ## Problem
  Work order and estimate line items keep getting duplicated when users save edits.
  The root cause is a combination of two issues:

  1. **RLS gap for managers**: The "Staff can delete work order line items" policy
     only covers roles staff/mechanic/master — NOT manager. A second policy checks
     company_id, but if the line item's company_id is NULL (which happens when the
     approve_estimate function doesn't set it), the comparison fails. So a manager
     editing a work order silently fails to delete old line items, and the new ones
     get inserted on top, creating duplicates.

  2. **Non-atomic save**: The frontend does delete-then-insert across separate
     network calls. Any failure in the delete step is silently ignored (Supabase
     returns success even when 0 rows are deleted), so the insert proceeds and
     duplicates accumulate.

  ## Fix
  ### Part 1: RLS Policy Fixes
  - Add 'manager' to the non-company-scoped delete policies for work_order_line_items
    and work_order_tasks, so managers can always delete regardless of company_id.
  - Make the company-scoped delete policies fall back to the parent record's
    company_id when the line item's own company_id is NULL.

  ### Part 2: Backfill NULL company_id
  - Set company_id on all work_order_line_items and work_order_tasks that have NULL
    company_id, using the parent work order's company_id.

  ### Part 3: Atomic Replace Functions
  - Create `replace_work_order_line_items` — a SECURITY DEFINER function that
    deletes all existing line items and tasks for a work order and inserts new ones
    in a single transaction. Bypasses RLS entirely, so company_id mismatches can't
    cause silent delete failures.
  - Create `replace_estimate_line_items` — same pattern for estimates.
*/

-- ============================================================
-- Part 1: Fix RLS Policies
-- ============================================================

-- Fix work_order_line_items DELETE: add manager to non-company policy
DROP POLICY IF EXISTS "Staff can delete work order line items" ON work_order_line_items;
CREATE POLICY "Staff can delete work order line items"
ON work_order_line_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    AND user_profiles.is_active = true
  )
);

-- Fix work_order_line_items DELETE: company policy should fall back to parent work_order's company_id
DROP POLICY IF EXISTS "Staff can delete company work order line items" ON work_order_line_items;
CREATE POLICY "Staff can delete company work order line items"
ON work_order_line_items FOR DELETE
TO authenticated
USING (
  (is_master_user() OR (
    COALESCE(
      work_order_line_items.company_id,
      (SELECT wo.company_id FROM work_orders wo WHERE wo.id = work_order_line_items.work_order_id)
    ) = get_user_company_id()
    AND is_staff()
  ))
);

-- Fix work_order_tasks DELETE: add manager to non-company policy
DROP POLICY IF EXISTS "Staff can delete work order tasks" ON work_order_tasks;
CREATE POLICY "Staff can delete work order tasks"
ON work_order_tasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    AND user_profiles.is_active = true
  )
);

-- Fix work_order_tasks DELETE: company policy should fall back to parent work_order's company_id
DROP POLICY IF EXISTS "Staff can delete company work order tasks" ON work_order_tasks;
CREATE POLICY "Staff can delete company work order tasks"
ON work_order_tasks FOR DELETE
TO authenticated
USING (
  (is_master_user() OR (
    COALESCE(
      work_order_tasks.company_id,
      (SELECT wo.company_id FROM work_orders wo WHERE wo.id = work_order_tasks.work_order_id)
    ) = get_user_company_id()
    AND is_staff()
  ))
);

-- Fix estimate_line_items DELETE: add manager to non-company policy (currently only staff/mechanic)
DROP POLICY IF EXISTS "Staff and mechanic can delete estimate line items" ON estimate_line_items;
CREATE POLICY "Staff and mechanic can delete estimate line items"
ON estimate_line_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid()
    AND up.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    AND up.is_active = true
  )
);

-- Fix estimate_tasks DELETE: add manager to non-company policy
DROP POLICY IF EXISTS "Staff can delete estimate tasks" ON estimate_tasks;
CREATE POLICY "Staff can delete estimate tasks"
ON estimate_tasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    AND user_profiles.is_active = true
  )
);

-- Also fix INSERT policies for work_order_line_items to include manager
DROP POLICY IF EXISTS "Staff can insert work order line items" ON work_order_line_items;
CREATE POLICY "Staff can insert work order line items"
ON work_order_line_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    AND user_profiles.is_active = true
  )
);

-- Also fix INSERT policies for work_order_tasks to include manager
DROP POLICY IF EXISTS "Staff can insert work order tasks" ON work_order_tasks;
CREATE POLICY "Staff can insert work order tasks"
ON work_order_tasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'master'::user_role, 'manager'::user_role])
    AND user_profiles.is_active = true
  )
);

-- ============================================================
-- Part 2: Backfill NULL company_id
-- ============================================================

UPDATE work_order_line_items
SET company_id = (SELECT wo.company_id FROM work_orders wo WHERE wo.id = work_order_line_items.work_order_id)
WHERE company_id IS NULL
AND EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_line_items.work_order_id AND wo.company_id IS NOT NULL);

UPDATE work_order_tasks
SET company_id = (SELECT wo.company_id FROM work_orders wo WHERE wo.id = work_order_tasks.work_order_id)
WHERE company_id IS NULL
AND EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = work_order_tasks.work_order_id AND wo.company_id IS NOT NULL);

-- ============================================================
-- Part 3: Atomic Replace Functions
-- ============================================================

-- Function to atomically replace all tasks and line items for a work order
-- Accepts the work order ID, user ID, and a JSONB array of tasks (each with lineItems)
CREATE OR REPLACE FUNCTION replace_work_order_line_items(
  p_work_order_id uuid,
  p_user_id uuid,
  p_tasks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task jsonb;
  v_line_item jsonb;
  v_task_id uuid;
  v_task_order int;
  v_line_order int;
  v_company_id uuid;
  v_work_order record;
BEGIN
  -- Verify the user has permission
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND is_active = true
    AND role IN ('staff', 'mechanic', 'master', 'manager')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit work orders';
  END IF;

  -- Get the work order and its company_id
  SELECT * INTO v_work_order FROM work_orders WHERE id = p_work_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;
  v_company_id := v_work_order.company_id;

  -- Atomically delete ALL existing line items and tasks, then insert new ones
  -- This runs as SECURITY DEFINER so RLS can't block the delete
  DELETE FROM work_order_line_items WHERE work_order_id = p_work_order_id;
  DELETE FROM work_order_task_assignments
    WHERE task_id IN (SELECT id FROM work_order_tasks WHERE work_order_id = p_work_order_id);
  DELETE FROM work_order_tasks WHERE work_order_id = p_work_order_id;

  -- Insert new tasks and their line items
  v_task_order := 0;
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    v_task_id := gen_random_uuid();

    INSERT INTO work_order_tasks (
      id, work_order_id, task_name, task_overview, task_order, apply_surcharge,
      is_completed, company_id
    ) VALUES (
      v_task_id, p_work_order_id,
      v_task->>'task_name',
      v_task->>'task_overview',
      v_task_order,
      COALESCE((v_task->>'apply_surcharge')::boolean, true),
      COALESCE((v_task->>'is_completed')::boolean, false),
      v_company_id
    );

    -- Insert line items for this task
    v_line_order := 0;
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'lineItems') LOOP
      INSERT INTO work_order_line_items (
        work_order_id, task_id, line_type, description, quantity, unit_price,
        total_price, is_taxable, labor_code_id, part_id, part_source,
        mercury_part_id, marine_wholesale_part_id, work_details, package_header,
        line_order, assigned_employee_id, time_entry_sent_at, time_entry_id,
        company_id
      ) VALUES (
        p_work_order_id, v_task_id,
        v_line_item->>'line_type',
        v_line_item->>'description',
        COALESCE((v_line_item->>'quantity')::numeric, 0),
        COALESCE((v_line_item->>'unit_price')::numeric, 0),
        COALESCE((v_line_item->>'total_price')::numeric, 0),
        COALESCE((v_line_item->>'is_taxable')::boolean, true),
        NULLIF(v_line_item->>'labor_code_id', '')::uuid,
        NULLIF(v_line_item->>'part_id', '')::uuid,
        NULLIF(v_line_item->>'part_source', '')::text,
        NULLIF(v_line_item->>'mercury_part_id', '')::uuid,
        NULLIF(v_line_item->>'marine_wholesale_part_id', '')::uuid,
        NULLIF(v_line_item->>'work_details', '')::text,
        NULLIF(v_line_item->>'package_header', '')::text,
        v_line_order,
        CASE WHEN v_line_item->>'line_type' = 'labor' THEN NULLIF(v_line_item->>'assigned_employee_id', '')::uuid ELSE NULL END,
        NULLIF(v_line_item->>'time_entry_sent_at', '')::timestamptz,
        NULLIF(v_line_item->>'time_entry_id', '')::uuid,
        v_company_id
      );
      v_line_order := v_line_order + 1;
    END LOOP;

    -- Insert task assignments
    IF v_task->'assignedEmployees' IS NOT NULL THEN
      FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'assignedEmployees') LOOP
        INSERT INTO work_order_task_assignments (task_id, employee_id, assigned_by)
        VALUES (v_task_id, v_line_item->>'employee_id', p_user_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    v_task_order := v_task_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'task_count', v_task_order);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION replace_work_order_line_items(uuid, uuid, jsonb) TO authenticated;

-- Function to atomically replace all tasks and line items for an estimate
CREATE OR REPLACE FUNCTION replace_estimate_line_items(
  p_estimate_id uuid,
  p_user_id uuid,
  p_tasks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task jsonb;
  v_line_item jsonb;
  v_task_id uuid;
  v_task_order int;
  v_line_order int;
  v_company_id uuid;
  v_estimate record;
BEGIN
  -- Verify the user has permission
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND is_active = true
    AND role IN ('staff', 'mechanic', 'master', 'manager')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit estimates';
  END IF;

  -- Get the estimate and its company_id
  SELECT * INTO v_estimate FROM estimates WHERE id = p_estimate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;
  v_company_id := v_estimate.company_id;

  -- Atomically delete ALL existing line items and tasks, then insert new ones
  DELETE FROM estimate_line_items WHERE estimate_id = p_estimate_id;
  DELETE FROM estimate_tasks WHERE estimate_id = p_estimate_id;

  -- Insert new tasks and their line items
  v_task_order := 0;
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    v_task_id := gen_random_uuid();

    INSERT INTO estimate_tasks (
      id, estimate_id, task_name, task_overview, task_order, apply_surcharge,
      company_id
    ) VALUES (
      v_task_id, p_estimate_id,
      v_task->>'task_name',
      v_task->>'task_overview',
      v_task_order,
      COALESCE((v_task->>'apply_surcharge')::boolean, true),
      v_company_id
    );

    -- Insert line items for this task
    v_line_order := 0;
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'lineItems') LOOP
      INSERT INTO estimate_line_items (
        estimate_id, task_id, line_type, description, quantity, unit_price,
        total_price, is_taxable, labor_code_id, part_id, mercury_part_id,
        marine_wholesale_part_id, part_source, core_charge_amount,
        container_charge_amount, accounting_code_id, work_details, package_header,
        line_order, company_id
      ) VALUES (
        p_estimate_id, v_task_id,
        v_line_item->>'line_type',
        v_line_item->>'description',
        COALESCE((v_line_item->>'quantity')::numeric, 0),
        COALESCE((v_line_item->>'unit_price')::numeric, 0),
        COALESCE((v_line_item->>'total_price')::numeric, 0),
        COALESCE((v_line_item->>'is_taxable')::boolean, true),
        NULLIF(v_line_item->>'labor_code_id', '')::uuid,
        NULLIF(v_line_item->>'part_id', '')::uuid,
        NULLIF(v_line_item->>'mercury_part_id', '')::uuid,
        NULLIF(v_line_item->>'marine_wholesale_part_id', '')::uuid,
        NULLIF(v_line_item->>'part_source', '')::text,
        NULLIF(v_line_item->>'core_charge_amount', '')::numeric,
        NULLIF(v_line_item->>'container_charge_amount', '')::numeric,
        NULLIF(v_line_item->>'accounting_code_id', '')::uuid,
        NULLIF(v_line_item->>'work_details', '')::text,
        NULLIF(v_line_item->>'package_header', '')::text,
        v_line_order,
        v_company_id
      );
      v_line_order := v_line_order + 1;
    END LOOP;

    v_task_order := v_task_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'task_count', v_task_order);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION replace_estimate_line_items(uuid, uuid, jsonb) TO authenticated;
