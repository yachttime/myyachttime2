/*
  # Fix Approve and Deny Estimate Functions

  1. Changes
    - Fix approve_estimate to use user_id instead of id when checking user permissions
    - Fix deny_estimate to use user_id instead of id when checking user permissions
*/

-- Function to approve estimate and convert to work order
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
  -- Check if user has permission (staff, mechanic, or master role)
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND role IN ('staff', 'mechanic', 'master')
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only staff, mechanic, or master users can approve estimates';
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

  -- Update estimate status to approved
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

  -- Create work order
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
    work_order_task_id,
    line_type,
    description,
    quantity,
    unit_price,
    total_price,
    is_taxable,
    labor_code_id,
    part_id,
    work_details
  )
  SELECT
    wot.id,
    eli.line_type,
    eli.description,
    eli.quantity,
    eli.unit_price,
    eli.total_price,
    eli.is_taxable,
    eli.labor_code_id,
    eli.part_id,
    eli.work_details
  FROM estimate_line_items eli
  JOIN estimate_tasks et ON eli.estimate_task_id = et.id
  JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id 
    AND wot.task_name = et.task_name 
    AND wot.task_order = et.task_order
  WHERE et.estimate_id = p_estimate_id;

  -- Process inventory deductions
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

-- Function to deny/reject estimate
CREATE OR REPLACE FUNCTION deny_estimate(
  p_estimate_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estimate record;
BEGIN
  -- Check if user has permission (staff, mechanic, or master role)
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND role IN ('staff', 'mechanic', 'master')
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only staff, mechanic, or master users can deny estimates';
  END IF;

  -- Get estimate details
  SELECT * INTO v_estimate
  FROM estimates
  WHERE id = p_estimate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  -- Check if estimate can be denied
  IF v_estimate.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Estimate cannot be denied. Current status: %', v_estimate.status;
  END IF;

  -- Update estimate status to rejected
  UPDATE estimates
  SET 
    status = 'rejected',
    updated_at = now()
  WHERE id = p_estimate_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Estimate has been rejected'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_estimate TO authenticated;
GRANT EXECUTE ON FUNCTION deny_estimate TO authenticated;
