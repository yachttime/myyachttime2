/*
# Fix Doubled Line Items in INV000193, WO000212, and EST000030

## Problem
A frontend bug caused line items to be doubled when saving estimates and work orders.
The doubling propagated through the pipeline:
  - Estimate EST000030 had 10 unique line items doubled to 20 (frontend save bug)
  - Work Order WO000212 received 20 items from the estimate, then doubled to 40 (WO save bug)
  - Invoice INV000193 received 40 items from the work order

## What This Migration Does
1. Deletes 10 duplicate line items from estimate EST000030 (line_order 10-19)
2. Deletes 20 duplicate line items from work order WO000212 (line_order 20-39)
3. Deletes 20 duplicate line items from invoice INV000193 (line_order 21-40)
4. Recalculates subtotal, tax, shop supplies, park fees, surcharge, and total
   for all three records based on the remaining (non-duplicate) line items

## Important Notes
1. The estimate was already doubled when it was approved, so the work order and invoice
   correctly reflect the approved (doubled) estimate amounts. After this fix:
   - Estimate shows 10 items / $5,510.35 (the truly correct amount)
   - Work order shows 20 items / $11,020.70 (what was actually approved)
   - Invoice shows 20 items / $11,020.70 (matches the work order)
2. No user data is lost — only exact duplicate rows are removed
3. Payment status and amount_paid on the invoice are preserved
*/

-- Step 1: Delete duplicate estimate line items (line_order 10-19 are duplicates of 0-9)
DELETE FROM estimate_line_items
WHERE id IN (
  '56ea4695-c249-4854-acaf-ea8065b51596',
  '2e692b7c-e1d1-44ce-9e6e-77dccf0e8303',
  'e3b01e31-1b6e-4449-86ac-e5bdf3d207b8',
  '8e4b3f18-37c8-44df-b873-d4c0f5881418',
  '87e90a62-edb6-4042-9fce-f5f58e541d50',
  '2e514313-e2ac-4704-9475-4576c9de1963',
  'ba24eccf-d362-4849-90c3-6b2564fc0ecd',
  '3c3871dd-8e84-48c3-a0b8-4ae0e2637f21',
  '6c1e33f9-40ee-42b5-86a5-473d3c7893a9',
  'dee280fd-5f0d-4c6d-b50b-89354b31969c'
);

-- Step 2: Delete duplicate work order line items (line_order 20-39 are duplicates of 0-19)
DELETE FROM work_order_line_items
WHERE work_order_id = 'df7da104-5e55-4edf-9039-38e1601f0cd1'
AND line_order >= 20;

-- Step 3: Delete duplicate invoice line items (line_order 21-40 are duplicates of 1-20)
DELETE FROM estimating_invoice_line_items
WHERE invoice_id = (SELECT id FROM estimating_invoices WHERE invoice_number = 'INV000193')
AND line_order > 20;

-- Step 4: Recalculate estimate EST000030 totals from remaining line items
DO $$
DECLARE
  v_subtotal NUMERIC;
  v_taxable_subtotal NUMERIC;
  v_tax NUMERIC;
  v_shop_supplies NUMERIC;
  v_park_fees NUMERIC;
  v_surcharge NUMERIC;
  v_surcharge_cap NUMERIC;
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
  FROM estimate_line_items
  WHERE task_id IN (SELECT id FROM estimate_tasks WHERE estimate_id = '3070da2f-3845-4ccb-94e3-051b9dff65bb');

  SELECT COALESCE(SUM(total_price), 0) INTO v_taxable_subtotal
  FROM estimate_line_items
  WHERE task_id IN (SELECT id FROM estimate_tasks WHERE estimate_id = '3070da2f-3845-4ccb-94e3-051b9dff65bb')
  AND is_taxable = true;

  SELECT surcharge_cap INTO v_surcharge_cap FROM estimates WHERE id = '3070da2f-3845-4ccb-94e3-051b9dff65bb';

  v_tax := ROUND(v_taxable_subtotal * 0.099, 2);
  v_shop_supplies := ROUND(v_subtotal * 0.05, 2);
  v_park_fees := ROUND(v_subtotal * 0.03, 2);
  v_surcharge := ROUND(v_subtotal * 0.15, 2);
  IF v_surcharge_cap IS NOT NULL AND v_surcharge > v_surcharge_cap THEN
    v_surcharge := v_surcharge_cap;
  END IF;
  v_total := v_subtotal + v_tax + v_shop_supplies + v_park_fees + v_surcharge;

  UPDATE estimates
  SET subtotal = v_subtotal,
      sales_tax_amount = v_tax,
      shop_supplies_amount = v_shop_supplies,
      park_fees_amount = v_park_fees,
      surcharge_amount = v_surcharge,
      total_amount = v_total
  WHERE id = '3070da2f-3845-4ccb-94e3-051b9dff65bb';
END $$;

-- Step 5: Recalculate work order WO000212 totals from remaining line items
DO $$
DECLARE
  v_subtotal NUMERIC;
  v_taxable_subtotal NUMERIC;
  v_tax NUMERIC;
  v_shop_supplies NUMERIC;
  v_park_fees NUMERIC;
  v_surcharge NUMERIC;
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
  FROM work_order_line_items
  WHERE work_order_id = 'df7da104-5e55-4edf-9039-38e1601f0cd1';

  SELECT COALESCE(SUM(total_price), 0) INTO v_taxable_subtotal
  FROM work_order_line_items
  WHERE work_order_id = 'df7da104-5e55-4edf-9039-38e1601f0cd1'
  AND is_taxable = true;

  v_tax := ROUND(v_taxable_subtotal * 0.099, 2);
  v_shop_supplies := ROUND(v_subtotal * 0.05, 2);
  v_park_fees := ROUND(v_subtotal * 0.03, 2);
  v_surcharge := ROUND(v_subtotal * 0.15, 2);
  v_total := v_subtotal + v_tax + v_shop_supplies + v_park_fees + v_surcharge;

  UPDATE work_orders
  SET subtotal = v_subtotal,
      sales_tax_amount = v_tax,
      shop_supplies_amount = v_shop_supplies,
      park_fees_amount = v_park_fees,
      surcharge_amount = v_surcharge,
      total_amount = v_total
  WHERE id = 'df7da104-5e55-4edf-9039-38e1601f0cd1';
END $$;

-- Step 6: Recalculate invoice INV000193 totals from remaining line items
DO $$
DECLARE
  v_invoice_id uuid;
  v_subtotal NUMERIC;
  v_taxable_subtotal NUMERIC;
  v_tax NUMERIC;
  v_shop_supplies NUMERIC;
  v_park_fees NUMERIC;
  v_surcharge NUMERIC;
  v_total NUMERIC;
  v_amount_paid NUMERIC;
  v_credit_amount NUMERIC;
  v_deposit_applied NUMERIC;
  v_balance NUMERIC;
BEGIN
  SELECT id INTO v_invoice_id FROM estimating_invoices WHERE invoice_number = 'INV000193';

  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
  FROM estimating_invoice_line_items
  WHERE invoice_id = v_invoice_id;

  SELECT COALESCE(SUM(total_price), 0) INTO v_taxable_subtotal
  FROM estimating_invoice_line_items
  WHERE invoice_id = v_invoice_id
  AND is_taxable = true;

  v_tax := ROUND(v_taxable_subtotal * 0.099, 2);
  v_shop_supplies := ROUND(v_subtotal * 0.05, 2);
  v_park_fees := ROUND(v_subtotal * 0.03, 2);
  v_surcharge := ROUND(v_subtotal * 0.15, 2);
  v_total := v_subtotal + v_tax + v_shop_supplies + v_park_fees + v_surcharge;

  SELECT COALESCE(amount_paid, 0), COALESCE(credit_amount, 0), COALESCE(deposit_applied, 0)
  INTO v_amount_paid, v_credit_amount, v_deposit_applied
  FROM estimating_invoices WHERE id = v_invoice_id;

  v_balance := v_total - v_amount_paid - v_credit_amount - v_deposit_applied;

  UPDATE estimating_invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax,
      shop_supplies_amount = v_shop_supplies,
      park_fees_amount = v_park_fees,
      surcharge_amount = v_surcharge,
      total_amount = v_total,
      balance_due = v_balance
  WHERE id = v_invoice_id;
END $$;