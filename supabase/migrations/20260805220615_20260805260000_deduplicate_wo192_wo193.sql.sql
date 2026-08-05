/*
  # Deduplicate WO000192 and WO000193 line items within tasks

  ## Problem
  These work orders have more line items than their parent estimates because
  users added items after approval AND some items were duplicated. We can't
  blindly rebuild from the estimate because we'd lose user-added items.

  ## Approach
  Remove exact duplicate line items within each task (same description,
  quantity, unit_price, total_price), keeping only the first occurrence
  (lowest line_order). Then recalculate totals.
*/

DO $$
DECLARE
  v_wo_id uuid;
  v_wo_number text;
  v_invoice_id uuid;
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
  v_line_order int;
BEGIN
  SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;

  FOR v_wo_record IN
    SELECT wo.id, wo.work_order_number
    FROM work_orders wo
    WHERE wo.work_order_number IN ('WO000192','WO000193')
  LOOP
    v_wo_id := v_wo_record.id;
    v_wo_number := v_wo_record.work_order_number;
    RAISE NOTICE 'Processing %', v_wo_number;

    -- Delete duplicate line items within each task: keep only the row with
    -- the lowest line_order for each (task_id, description, quantity, unit_price, total_price) group
    DELETE FROM work_order_line_items
    WHERE id IN (
      SELECT woli.id
      FROM (
        SELECT
          woli.id,
          woli.task_id,
          woli.description,
          woli.quantity,
          woli.unit_price,
          woli.total_price,
          woli.line_order,
          ROW_NUMBER() OVER (
            PARTITION BY woli.task_id, woli.description, woli.quantity, woli.unit_price, woli.total_price
            ORDER BY woli.line_order
          ) AS rn
        FROM work_order_line_items woli
        WHERE woli.work_order_id = v_wo_id
      ) woli
      WHERE woli.rn > 1
    );

    -- Re-number line_order sequentially within each task
    v_line_order := 0;
    FOR v_li IN
      SELECT woli.id, woli.task_id
      FROM work_order_line_items woli
      WHERE woli.work_order_id = v_wo_id
      ORDER BY woli.task_id, woli.line_order
    LOOP
      UPDATE work_order_line_items SET line_order = v_line_order WHERE id = v_li.id;
      v_line_order := v_line_order + 1;
    END LOOP;

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

    -- Update linked invoice
    SELECT id INTO v_invoice_id
    FROM estimating_invoices
    WHERE work_order_id = v_wo_id
    LIMIT 1;

    IF v_invoice_id IS NOT NULL THEN
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

      RAISE NOTICE '  Invoice updated';
    END IF;
  END LOOP;
END $$;
