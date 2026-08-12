/*
# Sync invoice line items when work order line items change

## Problem
When a work order that has already been converted to an invoice is edited
(via the Work Orders screen), the `replace_work_order_line_items` function
updates `work_order_line_items` but does NOT update the corresponding
`estimating_invoice_line_items`. This causes a mismatch: the invoice header
totals (subtotal, tax, total) reflect the new line items, but the invoice
detail view only shows the old line items snapshot.

## Fix
1. Create a new function `sync_invoice_line_items_from_work_order` that:
   - Finds any estimating invoice linked to the given work order
   - Deletes all existing invoice line items for that invoice
   - Re-inserts them from the work order's current line items (non-charge-type)
   - Recalculates the invoice header totals (subtotal, tax, total, balance)
2. Modify `replace_work_order_line_items` to call this sync function at the end

## Security
- The sync function is SECURITY DEFINER, same as the replace function
- It inherits the permission check already done by the caller
- No new RLS policies needed (no new tables)
- No data is lost: the invoice line items are rebuilt from the work order's
  current state, which is the authoritative source
*/

-- ============================================================
-- Function: sync_invoice_line_items_from_work_order
-- Rebuilds estimating_invoice_line_items from work_order_line_items
-- and recalculates invoice header totals
-- ============================================================
CREATE OR REPLACE FUNCTION sync_invoice_line_items_from_work_order(
  p_work_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_record record;
  v_new_subtotal numeric;
  v_taxable_amount numeric;
  v_discounted_subtotal numeric;
  v_taxable_after_discount numeric;
  v_tax_amount numeric;
  v_new_total numeric;
  v_new_balance numeric;
  v_line_order int;
  v_charge_types text[] := ARRAY['shop_supplies', 'park_fees', 'surcharge'];
BEGIN
  -- Find the estimating invoice linked to this work order
  SELECT id INTO v_invoice_id
  FROM estimating_invoices
  WHERE work_order_id = p_work_order_id
  LIMIT 1;

  -- If no linked invoice, nothing to sync
  IF v_invoice_id IS NULL THEN
    RETURN;
  END IF;

  -- Get the invoice record for existing totals
  SELECT * INTO v_invoice_record
  FROM estimating_invoices
  WHERE id = v_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Delete all existing invoice line items
  DELETE FROM estimating_invoice_line_items WHERE invoice_id = v_invoice_id;

  -- Re-insert from work order line items (excluding charge-type items)
  v_line_order := 0;
  FOR v_invoice_record IN
    SELECT
      wo_li.line_type,
      wo_li.description,
      wo_li.quantity,
      wo_li.unit_price,
      wo_li.total_price,
      wo_li.is_taxable,
      wo_li.work_details,
      wo_t.task_name
    FROM work_order_line_items wo_li
    JOIN work_order_tasks wo_t ON wo_t.id = wo_li.task_id
    WHERE wo_li.work_order_id = p_work_order_id
      AND wo_li.line_type <> ALL(v_charge_types)
    ORDER BY wo_t.task_order, wo_li.line_order
  LOOP
    INSERT INTO estimating_invoice_line_items (
      invoice_id,
      task_name,
      line_type,
      description,
      quantity,
      unit_price,
      total_price,
      is_taxable,
      line_order,
      work_details
    ) VALUES (
      v_invoice_id,
      v_invoice_record.task_name,
      v_invoice_record.line_type,
      v_invoice_record.description,
      v_invoice_record.quantity,
      v_invoice_record.unit_price,
      v_invoice_record.total_price,
      v_invoice_record.is_taxable,
      v_line_order,
      v_invoice_record.work_details
    );
    v_line_order := v_line_order + 1;
  END LOOP;

  -- Recalculate invoice header totals
  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM estimating_invoice_line_items
  WHERE invoice_id = v_invoice_id;

  -- Calculate taxable amount (items marked is_taxable)
  SELECT COALESCE(SUM(total_price), 0) INTO v_taxable_amount
  FROM estimating_invoice_line_items
  WHERE invoice_id = v_invoice_id AND is_taxable = true;

  -- Apply discount proportionally
  v_discounted_subtotal := GREATEST(0, v_new_subtotal - COALESCE(v_invoice_record.discount_amount, 0));

  IF v_new_subtotal > 0 AND v_discounted_subtotal > 0 THEN
    v_taxable_after_discount := ROUND(v_taxable_amount * (v_discounted_subtotal / v_new_subtotal), 2);
  ELSE
    v_taxable_after_discount := v_taxable_amount;
  END IF;

  v_tax_amount := ROUND(v_taxable_after_discount * COALESCE(v_invoice_record.tax_rate, 0), 2);
  v_new_total := ROUND(
    v_discounted_subtotal
    + v_tax_amount
    + COALESCE(v_invoice_record.shop_supplies_amount, 0)
    + COALESCE(v_invoice_record.park_fees_amount, 0)
    + COALESCE(v_invoice_record.surcharge_amount, 0),
    2
  );

  v_new_balance := GREATEST(0,
    v_new_total
    - COALESCE(v_invoice_record.deposit_applied, 0)
    - COALESCE(v_invoice_record.amount_paid, 0)
  );

  -- Update the invoice header
  UPDATE estimating_invoices
  SET
    subtotal = v_new_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_new_total,
    balance_due = v_new_balance
  WHERE id = v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_invoice_line_items_from_work_order(uuid) TO authenticated;

-- ============================================================
-- Modify replace_work_order_line_items to call the sync function
-- at the end, after all line items have been replaced
-- ============================================================
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

  -- Sync invoice line items if this work order has a linked invoice
  PERFORM sync_invoice_line_items_from_work_order(p_work_order_id);

  RETURN jsonb_build_object('success', true, 'task_count', v_task_order);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_work_order_line_items(uuid, uuid, jsonb) TO authenticated;