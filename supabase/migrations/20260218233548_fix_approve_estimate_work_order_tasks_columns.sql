/*
  # Fix approve_estimate - correct work_order_tasks column names

  ## Summary
  The function was using task_description and status columns that don't exist on
  work_order_tasks. The correct column is task_overview (not task_description) and
  there is no status column on work_order_tasks.
*/

CREATE OR REPLACE FUNCTION public.approve_estimate(p_estimate_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estimate record;
  v_work_order_id uuid;
  v_work_order_number text;
  v_task record;
  v_line_item record;
  v_task_id uuid;
  v_deposit_amount numeric;
BEGIN
  SELECT * INTO v_estimate
  FROM estimates
  WHERE id = p_estimate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  IF v_estimate.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Only estimates with status "draft" or "sent" can be approved';
  END IF;

  UPDATE estimates
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = p_user_id
  WHERE id = p_estimate_id;

  v_work_order_number := generate_work_order_number();

  v_deposit_amount := NULL;
  IF v_estimate.deposit_required THEN
    IF v_estimate.deposit_percentage IS NOT NULL THEN
      v_deposit_amount := v_estimate.total_amount * (v_estimate.deposit_percentage / 100);
    ELSIF v_estimate.deposit_amount IS NOT NULL THEN
      v_deposit_amount := v_estimate.deposit_amount;
    END IF;
  END IF;

  INSERT INTO work_orders (
    work_order_number,
    estimate_id,
    yacht_id,
    vessel_id,
    customer_name,
    customer_email,
    customer_phone,
    is_retail_customer,
    marina_name,
    manager_name,
    manager_email,
    manager_phone,
    status,
    subtotal,
    shop_supplies_rate,
    shop_supplies_amount,
    park_fees_rate,
    park_fees_amount,
    surcharge_rate,
    surcharge_amount,
    sales_tax_rate,
    sales_tax_amount,
    total_amount,
    notes,
    customer_notes,
    created_by,
    deposit_required,
    deposit_amount,
    deposit_payment_status,
    company_id
  ) VALUES (
    v_work_order_number,
    p_estimate_id,
    v_estimate.yacht_id,
    v_estimate.customer_vessel_id,
    v_estimate.customer_name,
    v_estimate.customer_email,
    v_estimate.customer_phone,
    v_estimate.is_retail_customer,
    v_estimate.marina_name,
    v_estimate.manager_name,
    v_estimate.manager_email,
    v_estimate.manager_phone,
    'pending',
    v_estimate.subtotal,
    v_estimate.shop_supplies_rate,
    v_estimate.shop_supplies_amount,
    v_estimate.park_fees_rate,
    v_estimate.park_fees_amount,
    v_estimate.surcharge_rate,
    v_estimate.surcharge_amount,
    v_estimate.sales_tax_rate,
    v_estimate.sales_tax_amount,
    v_estimate.total_amount,
    v_estimate.notes,
    v_estimate.customer_notes,
    p_user_id,
    v_estimate.deposit_required,
    v_deposit_amount,
    CASE WHEN v_estimate.deposit_required THEN 'pending' ELSE 'not_required' END,
    v_estimate.company_id
  ) RETURNING id INTO v_work_order_id;

  FOR v_task IN
    SELECT * FROM estimate_tasks
    WHERE estimate_id = p_estimate_id
    ORDER BY task_order
  LOOP
    INSERT INTO work_order_tasks (
      work_order_id,
      task_name,
      task_overview,
      task_order,
      apply_surcharge,
      company_id
    ) VALUES (
      v_work_order_id,
      v_task.task_name,
      v_task.task_overview,
      v_task.task_order,
      v_task.apply_surcharge,
      v_task.company_id
    ) RETURNING id INTO v_task_id;

    FOR v_line_item IN
      SELECT * FROM estimate_line_items
      WHERE task_id = v_task.id
      ORDER BY line_order
    LOOP
      INSERT INTO work_order_line_items (
        task_id,
        line_type,
        description,
        quantity,
        unit_price,
        total_price,
        is_taxable,
        labor_code_id,
        part_id,
        line_order,
        work_details
      ) VALUES (
        v_task_id,
        v_line_item.line_type,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.total_price,
        v_line_item.is_taxable,
        v_line_item.labor_code_id,
        v_line_item.part_id,
        v_line_item.line_order,
        v_line_item.work_details
      );
    END LOOP;
  END LOOP;

  UPDATE estimates
  SET status = 'converted'
  WHERE id = p_estimate_id;

  RETURN v_work_order_id;
END;
$$;
