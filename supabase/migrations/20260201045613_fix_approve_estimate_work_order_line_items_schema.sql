/*
  # Fix Approve Estimate - Correct work_order_line_items Schema

  1. Changes
    - Fix INSERT statement to use correct columns: work_order_id and task_id
    - Remove reference to non-existent work_order_task_id column
  
  2. Notes
    - work_order_line_items has work_order_id and task_id, not work_order_task_id
*/

CREATE OR REPLACE FUNCTION approve_estimate(
  p_estimate_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estimate record;
  v_work_order_id uuid;
  v_work_order_number text;
  v_next_number integer;
  v_inventory_result jsonb;
BEGIN
  -- Check if user has permission
  -- Allowed: staff, mechanic, master, OR manager with can_approve_repairs
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

  -- Get estimate details
  SELECT * INTO v_estimate
  FROM estimates
  WHERE id = p_estimate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  -- Check if estimate can be approved
  IF v_estimate.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Estimate cannot be approved. Current status: %', v_estimate.status;
  END IF;

  -- Update estimate status to approved (use user_id directly)
  UPDATE estimates
  SET 
    status = 'approved',
    approved_by = p_user_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_estimate_id;

  -- Generate work order number
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 3) AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM work_orders;
  
  v_work_order_number := 'WO' || LPAD(v_next_number::text, 6, '0');

  -- Create work order (use user_id directly)
  INSERT INTO work_orders (
    work_order_number,
    estimate_id,
    yacht_id,
    customer_name,
    customer_email,
    customer_phone,
    is_retail_customer,
    status,
    total_hours_worked,
    subtotal,
    sales_tax_rate,
    sales_tax_amount,
    shop_supplies_rate,
    shop_supplies_amount,
    park_fees_rate,
    park_fees_amount,
    surcharge_rate,
    surcharge_amount,
    total_amount,
    notes,
    customer_notes,
    created_by
  ) VALUES (
    v_work_order_number,
    p_estimate_id,
    v_estimate.yacht_id,
    v_estimate.customer_name,
    v_estimate.customer_email,
    v_estimate.customer_phone,
    v_estimate.is_retail_customer,
    'pending',
    0,
    v_estimate.subtotal,
    v_estimate.sales_tax_rate,
    v_estimate.sales_tax_amount,
    v_estimate.shop_supplies_rate,
    v_estimate.shop_supplies_amount,
    v_estimate.park_fees_rate,
    v_estimate.park_fees_amount,
    v_estimate.surcharge_rate,
    v_estimate.surcharge_amount,
    v_estimate.total_amount,
    v_estimate.notes,
    v_estimate.customer_notes,
    p_user_id
  )
  RETURNING id INTO v_work_order_id;

  -- Copy estimate tasks to work order tasks
  INSERT INTO work_order_tasks (
    work_order_id,
    task_name,
    task_overview,
    task_order,
    apply_surcharge,
    is_completed
  )
  SELECT
    v_work_order_id,
    task_name,
    task_overview,
    task_order,
    apply_surcharge,
    false
  FROM estimate_tasks
  WHERE estimate_id = p_estimate_id;

  -- Copy estimate line items to work order line items
  INSERT INTO work_order_line_items (
    work_order_id,
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
  )
  SELECT
    v_work_order_id,
    wot.id,
    eli.line_type,
    eli.description,
    eli.quantity,
    eli.unit_price,
    eli.total_price,
    eli.is_taxable,
    eli.labor_code_id,
    eli.part_id,
    eli.line_order,
    eli.work_details
  FROM estimate_line_items eli
  JOIN estimate_tasks et ON eli.task_id = et.id
  JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id 
    AND wot.task_name = et.task_name 
    AND wot.task_order = et.task_order
  WHERE et.estimate_id = p_estimate_id;

  -- Process inventory deductions (use user_id directly)
  SELECT process_estimate_inventory_deduction(p_estimate_id, p_user_id)
  INTO v_inventory_result;

  -- Update estimate status to converted
  UPDATE estimates
  SET 
    status = 'converted',
    updated_at = now()
  WHERE id = p_estimate_id;

  -- Return success with work order info and inventory alerts
  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', v_work_order_id,
    'work_order_number', v_work_order_number,
    'low_stock_alerts', COALESCE(v_inventory_result->'low_stock_alerts', '[]'::jsonb)
  );
END;
$$;
