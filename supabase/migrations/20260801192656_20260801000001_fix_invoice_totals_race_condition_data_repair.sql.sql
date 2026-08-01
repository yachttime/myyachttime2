/*
  # Fix Invoice Totals Race Condition — Data Repair

  ## Problem
  Three estimating invoices (INV000156, INV000171, INV000192) were created with stale
  header values (subtotal, tax, surcharge, shop supplies, park fees, total) due to a race
  condition between the frontend saving work order header fields and the
  convert_work_order_to_invoice function reading them. The invoice LINE ITEMS are correct
  in all three cases — only the summary header fields are wrong.

  ## Root Cause
  The convert_work_order_to_invoice function reads work_orders.subtotal,
  work_orders.sales_tax_amount, etc. at conversion time. If the work order header
  was updated a few seconds AFTER the invoice was created (which happened in all 3 cases),
  the invoice locks in the old header values while the line items are correct.

  ## Fix
  Recalculate each invoice's header fields from the work order's CURRENT header values
  (which are correct — they were updated after the invoice was created). Then recompute
  total_amount, balance_due, and payment_status.

  ### Per-invoice corrections:

  **INV000192** (WO000211 — Generator repair)
  - Subtotal: $350.00 → $3,301.32
  - Tax: $0.00 → $231.54
  - Shop supplies: $17.50 → $165.07
  - Park fees: $10.50 → $99.04
  - Surcharge: $52.50 → $495.20
  - Total: $430.50 → $4,292.17
  - Balance due: $430.50 → $4,292.17 (no payments)

  **INV000171** (WO000191 — 200 Hour oil change + bilge pump)
  - Subtotal: $1,457.44 → $3,088.66
  - Tax: $67.56 → $90.45
  - Shop supplies: $154.43 → $154.43 (unchanged, coincidentally correct)
  - Park fees: $92.66 → $92.66 (unchanged, coincidentally correct)
  - Surcharge: $218.61 → $463.30
  - Total: $1,990.70 → $3,889.50
  - Amount paid: $1,990.70 (Stripe ACH payment already received — preserved)
  - Balance due: $0.00 → $1,898.80
  - Payment status: paid → partial (customer was undercharged due to bug)

  **INV000156** (WO000177 — Race van)
  - Subtotal: $2,025.02 → $1,201.18
  - Tax: $0.00 → $38.18
  - Shop supplies: $0.00 → $0.00 (unchanged)
  - Park fees: $0.00 → $0.00 (unchanged)
  - Surcharge: $0.00 → $0.00 (unchanged)
  - Total: $2,025.02 → $1,239.36
  - Balance due: $2,025.02 → $1,239.36 (no payments)

  ## Important Notes
  1. INV000171 was already paid $1,990.70 via Stripe ACH. The correct total is $3,889.50,
     so the customer was undercharged by $1,898.80. The invoice is updated to "partial"
     status with the correct balance due. The Stripe payment records are preserved.
  2. Only header fields are updated — line items are NOT touched (they were always correct).
  3. The payment_status for INV000171 changes from "paid" to "partial" because the
     correct total exceeds the amount already paid.
*/
DO $$
DECLARE
  v_invoice_id uuid;
  v_wo_id uuid;
  v_subtotal numeric(10,2);
  v_tax numeric(10,2);
  v_shop numeric(10,2);
  v_park numeric(10,2);
  v_surcharge numeric(10,2);
  v_surcharge_cap numeric(10,2);
  v_capped_surcharge numeric(10,2);
  v_discount_rate numeric(10,6);
  v_discount_amount numeric(10,2);
  v_total numeric(10,2);
  v_deposit numeric(10,2);
  v_paid numeric(10,2);
  v_balance numeric(10,2);
  v_status text;
BEGIN
  -- Get surcharge cap from settings
  SELECT surcharge_cap INTO v_surcharge_cap FROM estimate_settings LIMIT 1;

  -- === INV000192 ===
  SELECT ei.id, ei.work_order_id INTO v_invoice_id, v_wo_id
  FROM estimating_invoices ei WHERE ei.invoice_number = 'INV000192';

  IF v_invoice_id IS NOT NULL THEN
    SELECT wo.subtotal, wo.sales_tax_amount, wo.shop_supplies_amount,
           wo.park_fees_amount, wo.surcharge_amount, wo.discount, wo.deposit_amount
    INTO v_subtotal, v_tax, v_shop, v_park, v_surcharge, v_discount_rate, v_deposit
    FROM work_orders wo WHERE wo.id = v_wo_id;

    v_capped_surcharge := CASE
      WHEN v_surcharge_cap IS NOT NULL AND v_surcharge > v_surcharge_cap
      THEN v_surcharge_cap ELSE COALESCE(v_surcharge, 0) END;

    v_discount_amount := COALESCE(v_subtotal, 0) * COALESCE(v_discount_rate, 0);
    v_total := COALESCE(v_subtotal,0) + COALESCE(v_tax,0) + COALESCE(v_shop,0) + COALESCE(v_park,0) + v_capped_surcharge - v_discount_amount;
    v_deposit := COALESCE(v_deposit, 0);
    v_paid := 0; -- no payments for this invoice

    SELECT COALESCE(SUM(ep.amount), 0) INTO v_paid
    FROM estimating_payments ep WHERE ep.invoice_id = v_invoice_id;

    v_balance := GREATEST(0, v_total - v_deposit - v_paid);
    v_status := CASE WHEN v_balance <= 0 THEN 'paid' ELSE 'unpaid' END;

    UPDATE estimating_invoices SET
      subtotal = v_subtotal,
      tax_amount = v_tax,
      shop_supplies_amount = v_shop,
      park_fees_amount = v_park,
      surcharge_amount = v_capped_surcharge,
      discount_amount = v_discount_amount,
      total_amount = v_total,
      balance_due = v_balance,
      deposit_applied = v_deposit,
      amount_paid = CASE WHEN v_status = 'paid' THEN v_paid ELSE amount_paid END,
      payment_status = v_status,
      updated_at = now()
    WHERE id = v_invoice_id;
  END IF;

  -- === INV000171 ===
  v_invoice_id := NULL; v_wo_id := NULL;
  SELECT ei.id, ei.work_order_id INTO v_invoice_id, v_wo_id
  FROM estimating_invoices ei WHERE ei.invoice_number = 'INV000171';

  IF v_invoice_id IS NOT NULL THEN
    SELECT wo.subtotal, wo.sales_tax_amount, wo.shop_supplies_amount,
           wo.park_fees_amount, wo.surcharge_amount, wo.discount, wo.deposit_amount
    INTO v_subtotal, v_tax, v_shop, v_park, v_surcharge, v_discount_rate, v_deposit
    FROM work_orders wo WHERE wo.id = v_wo_id;

    v_capped_surcharge := CASE
      WHEN v_surcharge_cap IS NOT NULL AND v_surcharge > v_surcharge_cap
      THEN v_surcharge_cap ELSE COALESCE(v_surcharge, 0) END;

    v_discount_amount := COALESCE(v_subtotal, 0) * COALESCE(v_discount_rate, 0);
    v_total := COALESCE(v_subtotal,0) + COALESCE(v_tax,0) + COALESCE(v_shop,0) + COALESCE(v_park,0) + v_capped_surcharge - v_discount_amount;
    v_deposit := COALESCE(v_deposit, 0);

    SELECT COALESCE(SUM(ep.amount), 0) INTO v_paid
    FROM estimating_payments ep WHERE ep.invoice_id = v_invoice_id;

    v_balance := GREATEST(0, v_total - v_deposit - v_paid);

    IF v_balance <= 0 THEN
      v_status := 'paid';
    ELSIF v_paid > 0 THEN
      v_status := 'partial';
    ELSE
      v_status := 'unpaid';
    END IF;

    UPDATE estimating_invoices SET
      subtotal = v_subtotal,
      tax_amount = v_tax,
      shop_supplies_amount = v_shop,
      park_fees_amount = v_park,
      surcharge_amount = v_capped_surcharge,
      discount_amount = v_discount_amount,
      total_amount = v_total,
      balance_due = v_balance,
      deposit_applied = v_deposit,
      amount_paid = v_paid,
      payment_status = v_status,
      updated_at = now()
    WHERE id = v_invoice_id;
  END IF;

  -- === INV000156 ===
  v_invoice_id := NULL; v_wo_id := NULL;
  SELECT ei.id, ei.work_order_id INTO v_invoice_id, v_wo_id
  FROM estimating_invoices ei WHERE ei.invoice_number = 'INV000156';

  IF v_invoice_id IS NOT NULL THEN
    SELECT wo.subtotal, wo.sales_tax_amount, wo.shop_supplies_amount,
           wo.park_fees_amount, wo.surcharge_amount, wo.discount, wo.deposit_amount
    INTO v_subtotal, v_tax, v_shop, v_park, v_surcharge, v_discount_rate, v_deposit
    FROM work_orders wo WHERE wo.id = v_wo_id;

    v_capped_surcharge := CASE
      WHEN v_surcharge_cap IS NOT NULL AND v_surcharge > v_surcharge_cap
      THEN v_surcharge_cap ELSE COALESCE(v_surcharge, 0) END;

    v_discount_amount := COALESCE(v_subtotal, 0) * COALESCE(v_discount_rate, 0);
    v_total := COALESCE(v_subtotal,0) + COALESCE(v_tax,0) + COALESCE(v_shop,0) + COALESCE(v_park,0) + v_capped_surcharge - v_discount_amount;
    v_deposit := COALESCE(v_deposit, 0);

    SELECT COALESCE(SUM(ep.amount), 0) INTO v_paid
    FROM estimating_payments ep WHERE ep.invoice_id = v_invoice_id;

    v_balance := GREATEST(0, v_total - v_deposit - v_paid);
    v_status := CASE WHEN v_balance <= 0 THEN 'paid' ELSE 'unpaid' END;

    UPDATE estimating_invoices SET
      subtotal = v_subtotal,
      tax_amount = v_tax,
      shop_supplies_amount = v_shop,
      park_fees_amount = v_park,
      surcharge_amount = v_capped_surcharge,
      discount_amount = v_discount_amount,
      total_amount = v_total,
      balance_due = v_balance,
      deposit_applied = v_deposit,
      amount_paid = CASE WHEN v_status = 'paid' THEN v_paid ELSE amount_paid END,
      payment_status = v_status,
      updated_at = now()
    WHERE id = v_invoice_id;
  END IF;
END;
$$;