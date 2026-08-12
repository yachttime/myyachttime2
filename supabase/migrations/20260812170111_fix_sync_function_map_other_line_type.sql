/*
# Fix sync function: map 'other' line_type to 'part' for invoice line items

## Problem
The sync_invoice_line_items_from_work_order function copies line_type directly
from work_order_line_items to estimating_invoice_line_items. But the work order
table allows 'other' as a line_type while the invoice table only allows
'labor', 'part', 'shop_supplies', 'park_fees', 'surcharge'. This causes a
check constraint violation when syncing work orders that contain 'other' type
line items.

## Fix
Map 'other' to 'part' when inserting into estimating_invoice_line_items.
'part' is the closest equivalent for miscellaneous billable items.
*/

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
  v_mapped_line_type text;
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
    -- Map 'other' to 'part' since estimating_invoice_line_items doesn't allow 'other'
    v_mapped_line_type := CASE WHEN v_invoice_record.line_type = 'other' THEN 'part' ELSE v_invoice_record.line_type END;

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
      v_mapped_line_type,
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