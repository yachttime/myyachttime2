/*
  # Clean Up Remaining Duplicated Line Items (Unpaid/Uninvoiced Work Orders)

  ## Problem
  Several work orders still have duplicated line items from the same root cause
  (silent RLS delete failures). This migration cleans up the ones that haven't
  been paid yet, so customers see correct invoice amounts.

  ## Affected Work Orders
  - WO000020 / INV null: 9 lines instead of 3 (tripled) — rebuild from estimate
  - WO000095 / INV000108 unpaid: 4 lines instead of 2 (doubled) — rebuild from estimate
  - WO000193 / INV000180 unpaid: 12 lines instead of 6 (doubled) — rebuild from estimate
  - WO000192 / INV000170 unpaid: 12 lines instead of 10 (2 extra) — rebuild from estimate

  WO000008, WO000161, WO000170, WO000208, WO000209 have line counts that match
  their estimates — the "duplicates" are legitimate items across multiple tasks.
  These are NOT touched.

  ## Approach
  For each affected work order: delete all line items and tasks, re-insert from
  the estimate's tasks and line items (same logic as approve_estimate), then
  recalculate totals for both the work order and its invoice (if any).
*/

DO $$
DECLARE
  v_wo_id uuid;
  v_wo_number text;
  v_estimate_id uuid;
  v_wot_id uuid;
  v_et_id uuid;
  v_invoice_id uuid;
  v_line_order int;
  v_subtotal numeric(10,2);
  v_taxable_subtotal numeric(10,2);
  v_surchargeable_subtotal numeric(10,2);
  v_tax_amount numeric(10,2);
  v_shop_supplies_amount numeric(10,2);
  v_park_fees_amount numeric(10,2);
  v_surcharge_amount numeric(10,2);
  v_capped_surcharge numeric(10,2);
  v_surcharge_cap numeric(10,2);
  v_discount_rate numeric(10,6);
  v_discount_amount numeric(10,2);
  v_total numeric(10,2);
  v_wo_record record;
  v_li record;
  v_company_id uuid;
BEGIN
  SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;

  FOR v_wo_record IN
    SELECT wo.id, wo.work_order_number, wo.estimate_id, wo.company_id
    FROM work_orders wo
    WHERE wo.work_order_number IN ('WO000020','WO000095','WO000193','WO000192')
  LOOP
    v_wo_id := v_wo_record.id;
    v_wo_number := v_wo_record.work_order_number;
    v_estimate_id := v_wo_record.estimate_id;
    v_company_id := v_wo_record.company_id;

    RAISE NOTICE 'Processing %', v_wo_number;

    -- Delete ALL existing line items and tasks (bypasses RLS since this runs as superuser)
    DELETE FROM work_order_line_items WHERE work_order_id = v_wo_id;
    DELETE FROM work_order_task_assignments
      WHERE task_id IN (SELECT id FROM work_order_tasks WHERE work_order_id = v_wo_id);
    DELETE FROM work_order_tasks WHERE work_order_id = v_wo_id;

    -- Re-insert tasks from estimate tasks
    INSERT INTO work_order_tasks (work_order_id, task_name, task_overview, task_order, apply_surcharge, is_completed, company_id)
    SELECT v_wo_id, task_name, task_overview, task_order, apply_surcharge, false, v_company_id
    FROM estimate_tasks WHERE estimate_id = v_estimate_id;

    -- Re-insert line items from estimate line items
    INSERT INTO work_order_line_items (
      work_order_id, task_id, line_type, description, quantity, unit_price,
      total_price, is_taxable, labor_code_id, part_id, line_order,
      work_details, package_header, company_id
    )
    SELECT
      v_wo_id, wot.id, eli.line_type, eli.description, eli.quantity,
      eli.unit_price, eli.total_price, eli.is_taxable, eli.labor_code_id,
      eli.part_id, eli.line_order, eli.work_details, eli.package_header, v_company_id
    FROM estimate_line_items eli
    JOIN estimate_tasks et ON eli.task_id = et.id
    JOIN work_order_tasks wot ON wot.work_order_id = v_wo_id
      AND wot.task_name = et.task_name AND wot.task_order = et.task_order;

    -- Recalculate work order totals
    SELECT
      COALESCE(SUM(woli.total_price), 0),
      COALESCE(SUM(CASE WHEN woli.is_taxable THEN woli.total_price ELSE 0 END), 0),
      COALESCE((
        SELECT SUM(woli2.total_price)
        FROM work_order_line_items woli2
        JOIN work_order_tasks wot2 ON woli2.task_id = wot2.id
        WHERE wot2.work_order_id = v_wo_id AND wot2.apply_surcharge = true
      ), 0)
    INTO v_subtotal, v_taxable_subtotal, v_surchargeable_subtotal
    FROM work_order_line_items woli
    JOIN work_order_tasks wot ON woli.task_id = wot.id
    WHERE wot.work_order_id = v_wo_id;

    SELECT wo.sales_tax_rate, wo.shop_supplies_rate, wo.shop_supplies_amount,
           wo.park_fees_rate, wo.park_fees_amount, wo.surcharge_rate, wo.discount
    INTO v_wo_record
    FROM work_orders wo WHERE wo.id = v_wo_id;

    v_tax_amount := v_taxable_subtotal * COALESCE(v_wo_record.sales_tax_rate, 0);

    IF COALESCE(v_wo_record.shop_supplies_amount, 0) > 0 THEN
      v_shop_supplies_amount := v_subtotal * COALESCE(v_wo_record.shop_supplies_rate, 0);
    ELSE
      v_shop_supplies_amount := 0;
    END IF;

    IF COALESCE(v_wo_record.park_fees_amount, 0) > 0 THEN
      v_park_fees_amount := v_subtotal * COALESCE(v_wo_record.park_fees_rate, 0);
    ELSE
      v_park_fees_amount := 0;
    END IF;

    v_surcharge_amount := v_surchargeable_subtotal * COALESCE(v_wo_record.surcharge_rate, 0);
    v_capped_surcharge := CASE
      WHEN v_surcharge_cap IS NOT NULL AND v_surcharge_amount > v_surcharge_cap
      THEN v_surcharge_cap
      ELSE v_surcharge_amount
    END;

    v_discount_rate := COALESCE(v_wo_record.discount, 0);
    v_discount_amount := v_subtotal * v_discount_rate;

    v_total := v_subtotal + v_tax_amount + v_shop_supplies_amount
      + v_park_fees_amount + v_capped_surcharge - v_discount_amount;

    UPDATE work_orders SET
      subtotal = v_subtotal,
      sales_tax_amount = v_tax_amount,
      shop_supplies_amount = v_shop_supplies_amount,
      park_fees_amount = v_park_fees_amount,
      surcharge_amount = v_capped_surcharge,
      total_amount = v_total
    WHERE id = v_wo_id;

    RAISE NOTICE '  WO totals: subtotal=%, tax=%, total=%', v_subtotal, v_tax_amount, v_total;

    -- Update linked invoice if any
    SELECT id INTO v_invoice_id
    FROM estimating_invoices
    WHERE work_order_id = v_wo_id
    LIMIT 1;

    IF v_invoice_id IS NOT NULL THEN
      -- Delete and re-insert invoice line items
      DELETE FROM estimating_invoice_line_items WHERE invoice_id = v_invoice_id;

      v_line_order := 0;
      FOR v_li IN
        SELECT wot.task_name, woli.line_type, woli.description, woli.quantity,
               woli.unit_price, woli.total_price, woli.is_taxable,
               woli.labor_code_id, woli.part_id, woli.work_details
        FROM work_order_line_items woli
        JOIN work_order_tasks wot ON woli.task_id = wot.id
        WHERE wot.work_order_id = v_wo_id
        ORDER BY wot.task_order, woli.line_order
      LOOP
        INSERT INTO estimating_invoice_line_items (
          invoice_id, task_name, line_type, description, quantity, unit_price,
          total_price, is_taxable, labor_code_id, part_id, line_order, work_details
        ) VALUES (
          v_invoice_id, v_li.task_name, v_li.line_type, v_li.description,
          v_li.quantity, v_li.unit_price, v_li.total_price, v_li.is_taxable,
          v_li.labor_code_id, v_li.part_id, v_line_order, v_li.work_details
        );
        v_line_order := v_line_order + 1;
      END LOOP;

      UPDATE estimating_invoices SET
        subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        shop_supplies_amount = v_shop_supplies_amount,
        park_fees_amount = v_park_fees_amount,
        surcharge_amount = v_capped_surcharge,
        discount_amount = v_discount_amount,
        total_amount = v_total,
        balance_due = GREATEST(0, v_total - COALESCE(estimating_invoices.deposit_applied, 0) - COALESCE(estimating_invoices.amount_paid, 0))
      WHERE id = v_invoice_id;

      RAISE NOTICE '  Invoice updated with corrected totals';
    END IF;

  END LOOP;
END $$;
