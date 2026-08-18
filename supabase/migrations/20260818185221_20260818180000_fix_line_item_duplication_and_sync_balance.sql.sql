/*
# Fix sync_invoice_line_items_from_work_order balance formula + add dedup guards

## Problem 1: Balance double-counting
sync_invoice_line_items_from_work_order still uses:
  v_new_balance = total - deposit_applied - amount_paid
But amount_paid already includes deposits, so this double-counts.

## Problem 2: Line item duplication
approve_estimate copies estimate_line_items to work_order_line_items via INSERT...SELECT.
If the estimate has duplicate line items (same description, type, qty, price within a task),
they get copied. No guard prevents this.

replace_work_order_line_items and replace_estimate_line_items both delete-all-then-insert
from a JSON array. If the front-end sends duplicate items, they get inserted with no guard.

## Fix
1. Fix balance formula to: total - amount_paid
2. Add DISTINCT ON dedup in approve_estimate's INSERT...SELECT for work_order_line_items
3. Add dedup logic in replace_work_order_line_items: skip items that are exact duplicates
   of an already-inserted item in the same task (same type, description, qty, unit_price)
4. Same dedup in replace_estimate_line_items
*/

-- ============================================================
-- Fix 1: sync_invoice_line_items_from_work_order balance formula
-- ============================================================
CREATE OR REPLACE FUNCTION sync_invoice_line_items_from_work_order(p_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_record record;
  v_li record;
  v_new_subtotal numeric;
  v_taxable_amount numeric;
  v_discounted_subtotal numeric;
  v_taxable_after_discount numeric;
  v_tax_amount numeric;
  v_new_total numeric;
  v_new_balance numeric;
  v_line_order int;
  v_charge_types text[] := ARRAY['shop_supplies', 'park_fees', 'surcharge'];
  v_mapped_line_type text;
BEGIN
  SELECT id INTO v_invoice_id
  FROM estimating_invoices
  WHERE work_order_id = p_work_order_id
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_invoice_record
  FROM estimating_invoices
  WHERE id = v_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM estimating_invoice_line_items WHERE invoice_id = v_invoice_id;

  v_line_order := 0;
  FOR v_li IN
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
    v_mapped_line_type := CASE WHEN v_li.line_type = 'other' THEN 'part' ELSE v_li.line_type END;

    INSERT INTO estimating_invoice_line_items (
      invoice_id, task_name, line_type, description, quantity, unit_price,
      total_price, is_taxable, line_order, work_details
    ) VALUES (
      v_invoice_id, v_li.task_name, v_mapped_line_type, v_li.description,
      v_li.quantity, v_li.unit_price, v_li.total_price, v_li.is_taxable,
      v_line_order, v_li.work_details
    );
    v_line_order := v_line_order + 1;
  END LOOP;

  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM estimating_invoice_line_items
  WHERE invoice_id = v_invoice_id;

  SELECT COALESCE(SUM(total_price), 0) INTO v_taxable_amount
  FROM estimating_invoice_line_items
  WHERE invoice_id = v_invoice_id AND is_taxable = true;

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

  v_new_balance := GREATEST(0, v_new_total - COALESCE(v_invoice_record.amount_paid, 0));

  UPDATE estimating_invoices
  SET
    subtotal = v_new_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_new_total,
    balance_due = v_new_balance
  WHERE id = v_invoice_id;
END;
$$;

-- ============================================================
-- Fix 2: approve_estimate - dedup line items during INSERT...SELECT
-- ============================================================
CREATE OR REPLACE FUNCTION approve_estimate(p_estimate_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estimate record;
  v_work_order_id uuid;
  v_work_order_number text;
  v_next_number integer;
  v_inventory_result jsonb;
  v_line_item record;
  v_vendor_name text;
  v_vendor_id uuid;
  v_vendor_contact text;
  v_vendor_email text;
  v_vendor_phone text;
  v_vendor_address text;
  v_vendor_city text;
  v_vendor_state text;
  v_vendor_zip text;
  v_vendor_source text;
  v_po_id uuid;
  v_po_number text;
  v_next_po_number integer;
  v_part_number text;
  v_yacht_name text;
  v_company_id uuid;
  v_repair_request record;
  v_surcharge_cap numeric(10,2);
  v_capped_surcharge numeric(10,2);
  v_capped_total numeric(10,2);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND is_active = true
    AND (
      role IN ('staff', 'mechanic', 'master')
      OR (role = 'manager' AND can_approve_repairs = true)
    )
  ) THEN
    RAISE EXCEPTION 'You do not have permission to approve estimates';
  END IF;

  SELECT * INTO v_estimate FROM estimates WHERE id = p_estimate_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  IF v_estimate.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Estimate cannot be approved. Current status: %', v_estimate.status;
  END IF;

  v_company_id := v_estimate.company_id;

  IF v_estimate.yacht_id IS NOT NULL THEN
    SELECT name INTO v_yacht_name FROM yachts WHERE id = v_estimate.yacht_id;
  END IF;

  SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;
  v_capped_surcharge := CASE
    WHEN v_surcharge_cap IS NOT NULL AND v_estimate.surcharge_amount > v_surcharge_cap
    THEN v_surcharge_cap
    ELSE v_estimate.surcharge_amount
  END;
  v_capped_total := v_estimate.subtotal
    + v_estimate.sales_tax_amount
    + COALESCE(v_estimate.shop_supplies_amount, 0)
    + COALESCE(v_estimate.park_fees_amount, 0)
    + COALESCE(v_capped_surcharge, 0);

  UPDATE estimates
  SET status = 'converted', approved_by = p_user_id, approved_at = now(), updated_at = now()
  WHERE id = p_estimate_id;

  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 3) AS INTEGER)), 0) + 1
  INTO v_next_number FROM work_orders;
  v_work_order_number := 'WO' || LPAD(v_next_number::text, 6, '0');

  INSERT INTO work_orders (
    work_order_number, estimate_id, yacht_id, vessel_id, customer_name, customer_email, customer_phone,
    is_retail_customer, status, total_hours_worked, subtotal, sales_tax_rate, sales_tax_amount,
    shop_supplies_rate, shop_supplies_amount, park_fees_rate, park_fees_amount,
    surcharge_rate, surcharge_amount, total_amount, notes, customer_notes, work_title, company_id, created_by,
    trip_inspection_id
  ) VALUES (
    v_work_order_number, p_estimate_id, v_estimate.yacht_id, v_estimate.customer_vessel_id,
    v_estimate.customer_name, v_estimate.customer_email, v_estimate.customer_phone,
    v_estimate.is_retail_customer, 'pending', 0,
    v_estimate.subtotal, v_estimate.sales_tax_rate, v_estimate.sales_tax_amount,
    v_estimate.shop_supplies_rate, v_estimate.shop_supplies_amount,
    v_estimate.park_fees_rate, v_estimate.park_fees_amount,
    v_estimate.surcharge_rate, v_capped_surcharge,
    v_capped_total, v_estimate.notes, v_estimate.customer_notes, v_estimate.work_title, v_company_id, p_user_id,
    v_estimate.trip_inspection_id
  )
  RETURNING id INTO v_work_order_id;

  SELECT * INTO v_repair_request
  FROM repair_requests
  WHERE estimate_id = p_estimate_id
  ORDER BY
    CASE WHEN deposit_payment_status = 'paid' THEN 0 ELSE 1 END,
    deposit_paid_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    UPDATE repair_requests
    SET work_order_id = v_work_order_id, updated_at = now()
    WHERE id = v_repair_request.id AND work_order_id IS NULL;

    IF v_repair_request.deposit_payment_status = 'paid' AND v_repair_request.deposit_amount IS NOT NULL THEN
      UPDATE work_orders
      SET
        deposit_required = true,
        deposit_amount = v_repair_request.deposit_amount,
        deposit_payment_status = 'paid',
        deposit_paid_at = v_repair_request.deposit_paid_at,
        deposit_payment_method_type = v_repair_request.deposit_payment_method_type
      WHERE id = v_work_order_id;

      UPDATE estimates
      SET
        repair_request_deposit_status = 'paid',
        repair_request_deposit_amount = v_repair_request.deposit_amount,
        repair_request_deposit_paid_at = v_repair_request.deposit_paid_at,
        repair_request_deposit_method = v_repair_request.deposit_payment_method_type,
        updated_at = now()
      WHERE id = p_estimate_id
      AND (repair_request_deposit_status IS NULL OR repair_request_deposit_status != 'paid');
    END IF;
  END IF;

  INSERT INTO work_order_tasks (work_order_id, task_name, task_overview, task_order, apply_surcharge, is_completed, company_id)
  SELECT v_work_order_id, task_name, task_overview, task_order, apply_surcharge, false, v_company_id
  FROM estimate_tasks WHERE estimate_id = p_estimate_id;

  -- Dedup: use DISTINCT ON to keep only the first occurrence of each
  -- (task_id, line_type, description, quantity, unit_price) combination
  INSERT INTO work_order_line_items (
    work_order_id, task_id, line_type, description, quantity, unit_price, total_price,
    is_taxable, labor_code_id, part_id, line_order, work_details, package_header, company_id
  )
  SELECT
    v_work_order_id, wot.id, dedup.line_type, dedup.description, dedup.quantity,
    dedup.unit_price, dedup.total_price, dedup.is_taxable, dedup.labor_code_id,
    dedup.part_id, dedup.line_order, dedup.work_details, dedup.package_header, v_company_id
  FROM (
    SELECT DISTINCT ON (et.id, eli.line_type, eli.description, eli.quantity, eli.unit_price)
      eli.line_type, eli.description, eli.quantity, eli.unit_price, eli.total_price,
      eli.is_taxable, eli.labor_code_id, eli.part_id, eli.line_order, eli.work_details,
      eli.package_header, et.id as estimate_task_id
    FROM estimate_line_items eli
    JOIN estimate_tasks et ON eli.task_id = et.id
    WHERE et.estimate_id = p_estimate_id
    ORDER BY et.id, eli.line_type, eli.description, eli.quantity, eli.unit_price, eli.line_order
  ) dedup
  JOIN estimate_tasks et ON et.id = dedup.estimate_task_id
  JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id
    AND wot.task_name = et.task_name AND wot.task_order = et.task_order;

  -- Create purchase orders for vendor parts (deduped)
  FOR v_line_item IN
    SELECT DISTINCT ON (eli.part_id, eli.description, eli.quantity, eli.unit_price)
      eli.*, et.task_name
    FROM estimate_line_items eli
    JOIN estimate_tasks et ON eli.task_id = et.id
    WHERE eli.estimate_id = p_estimate_id
      AND eli.line_type = 'part'
      AND eli.part_id IS NOT NULL
    ORDER BY eli.part_id, eli.description, eli.quantity, eli.unit_price
  LOOP
    SELECT v.vendor_name, v.id, v.contact_name, v.email, v.phone, v.address, v.city, v.state, v.zip
    INTO v_vendor_name, v_vendor_id, v_vendor_contact, v_vendor_email, v_vendor_phone, v_vendor_address, v_vendor_city, v_vendor_state, v_vendor_zip
    FROM parts_inventory p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.id = v_line_item.part_id;

    IF v_vendor_name IS NOT NULL THEN
      SELECT id INTO v_po_id FROM purchase_orders
      WHERE work_order_id = v_work_order_id AND vendor_name = v_vendor_name
      LIMIT 1;

      IF v_po_id IS NULL THEN
        SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 3) AS INTEGER)), 0) + 1
        INTO v_next_po_number FROM purchase_orders;
        v_po_number := 'PO' || LPAD(v_next_po_number::text, 6, '0');

        INSERT INTO purchase_orders (
          po_number, work_order_id, vendor_name, vendor_id, vendor_contact_name, vendor_email,
          vendor_phone, vendor_address, vendor_city, vendor_state, vendor_zip,
          yacht_name, status, company_id
        ) VALUES (
          v_po_number, v_work_order_id, v_vendor_name, v_vendor_id, v_vendor_contact, v_vendor_email,
          v_vendor_phone, v_vendor_address, v_vendor_city, v_vendor_state, v_vendor_zip,
          v_yacht_name, 'pending', v_company_id
        )
        RETURNING id INTO v_po_id;
      END IF;

      SELECT part_number INTO v_part_number FROM parts_inventory WHERE id = v_line_item.part_id;

      INSERT INTO purchase_order_line_items (
        purchase_order_id, part_id, part_number, description, quantity, unit_cost, total_cost, company_id
      ) VALUES (
        v_po_id, v_line_item.part_id, v_part_number, v_line_item.description,
        v_line_item.quantity, v_line_item.unit_price, v_line_item.total_price, v_company_id
      );
    END IF;
  END LOOP;

  v_inventory_result := process_estimate_inventory_deduction(p_estimate_id, p_user_id, v_work_order_id, v_company_id);

  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', v_work_order_id,
    'work_order_number', v_work_order_number,
    'inventory_result', v_inventory_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_estimate(uuid, uuid) TO authenticated;

-- ============================================================
-- Fix 3: replace_work_order_line_items - dedup before insert
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
  v_seen_items text[] := '{}';
  v_item_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND is_active = true
    AND role IN ('staff', 'mechanic', 'master', 'manager')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit work orders';
  END IF;

  SELECT * INTO v_work_order FROM work_orders WHERE id = p_work_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;
  v_company_id := v_work_order.company_id;

  DELETE FROM work_order_line_items WHERE work_order_id = p_work_order_id;
  DELETE FROM work_order_task_assignments
  WHERE task_id IN (SELECT id FROM work_order_tasks WHERE work_order_id = p_work_order_id);
  DELETE FROM work_order_tasks WHERE work_order_id = p_work_order_id;

  v_task_order := 0;
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    v_task_id := gen_random_uuid();
    v_seen_items := '{}';

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

    v_line_order := 0;
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'lineItems') LOOP
      -- Build a dedup key from type+description+quantity+unit_price
      v_item_key := (v_line_item->>'line_type') || '|' ||
                    COALESCE(v_line_item->>'description', '') || '|' ||
                    COALESCE(v_line_item->>'quantity', '0') || '|' ||
                    COALESCE(v_line_item->>'unit_price', '0');

      -- Skip if we've already inserted an identical item in this task
      IF NOT (v_item_key = ANY(v_seen_items)) THEN
        v_seen_items := array_append(v_seen_items, v_item_key);

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
      END IF;
    END LOOP;

    IF v_task->'assignedEmployees' IS NOT NULL THEN
      FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'assignedEmployees') LOOP
        INSERT INTO work_order_task_assignments (task_id, employee_id, assigned_by)
        VALUES (v_task_id, NULLIF(v_line_item->>'employee_id', '')::uuid, p_user_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    v_task_order := v_task_order + 1;
  END LOOP;

  PERFORM sync_invoice_line_items_from_work_order(p_work_order_id);

  RETURN jsonb_build_object('success', true, 'task_count', v_task_order);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_work_order_line_items(uuid, uuid, jsonb) TO authenticated;

-- ============================================================
-- Fix 4: replace_estimate_line_items - dedup before insert
-- ============================================================
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
  v_seen_items text[] := '{}';
  v_item_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
    AND is_active = true
    AND role IN ('staff', 'mechanic', 'master', 'manager')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit estimates';
  END IF;

  SELECT * INTO v_estimate FROM estimates WHERE id = p_estimate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;
  v_company_id := v_estimate.company_id;

  DELETE FROM estimate_line_items WHERE estimate_id = p_estimate_id;
  DELETE FROM estimate_tasks WHERE estimate_id = p_estimate_id;

  v_task_order := 0;
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    v_task_id := gen_random_uuid();
    v_seen_items := '{}';

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

    v_line_order := 0;
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_task->'lineItems') LOOP
      v_item_key := (v_line_item->>'line_type') || '|' ||
                    COALESCE(v_line_item->>'description', '') || '|' ||
                    COALESCE(v_line_item->>'quantity', '0') || '|' ||
                    COALESCE(v_line_item->>'unit_price', '0');

      IF NOT (v_item_key = ANY(v_seen_items)) THEN
        v_seen_items := array_append(v_seen_items, v_item_key);

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
      END IF;
    END LOOP;

    v_task_order := v_task_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'task_count', v_task_order);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_estimate_line_items(uuid, uuid, jsonb) TO authenticated;
