/*
# Fix: cast employee_id to uuid when inserting task assignments

## Problem
When saving a work order that has assigned employees on a task,
the `replace_work_order_line_items` function reads `employee_id` from
the JSON payload as text (via `->>`) and inserts it directly into
`work_order_task_assignments.employee_id`, which is a uuid column.
Postgres does not implicitly cast text to uuid in an INSERT, so it
throws: "column employee_id is of type uuid but expression is of type text".

## Fix
Add an explicit `::uuid` cast on `v_line_item->>'employee_id'` when
inserting into `work_order_task_assignments`. Also wrap in NULLIF so
an empty string becomes a NULL (caught by the NOT NULL constraint with
a clearer error) rather than a cryptic cast failure.

## Security
- No new tables, no RLS changes.
- The function is already SECURITY DEFINER and permission-checked.
- Only the assignment-insert statement changes.
*/

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

    -- Insert task assignments (cast employee_id text -> uuid explicitly)
    IF v_task->'assignedEmployees' IS NOT NULL THEN
      FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'assignedEmployees') LOOP
        INSERT INTO work_order_task_assignments (task_id, employee_id, assigned_by)
        VALUES (v_task_id, NULLIF(v_line_item->>'employee_id', '')::uuid, p_user_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    v_task_order := v_task_order + 1;
  END LOOP;

  -- Sync invoice line items if this work order has a linked invoice
  PERFORM sync_invoice_line_items_from_work_order(p_work_order_id);

  RETURN jsonb_build_object('success', true, 'task_count', v_task_order);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_work_order_line_items(uuid, uuid, jsonb) TO authenticated;
