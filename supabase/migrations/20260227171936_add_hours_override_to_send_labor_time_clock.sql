/*
  # Add hours override to send_assigned_labor_to_time_clock

  ## Changes
  - Adds optional `p_hours_override` parameter to `send_assigned_labor_to_time_clock`
  - Adds optional `p_employee_override` parameter so caller can specify a different employee
    than the one stored on the line item (used when splitting labor across multiple employees)
  - When `p_hours_override` is provided and > 0, it is used instead of line item quantity
  - When `p_employee_override` is provided, it overrides the line item's assigned_employee_id
  - The line item is only marked as `time_entry_sent_at` when no override is used (single employee)
    OR when `p_mark_sent` is true (caller signals this is the final/only send for this line item)
*/

CREATE OR REPLACE FUNCTION public.send_assigned_labor_to_time_clock(
  p_line_item_id uuid,
  p_work_date date DEFAULT CURRENT_DATE,
  p_created_by uuid DEFAULT NULL::uuid,
  p_hours_override numeric DEFAULT NULL,
  p_employee_override uuid DEFAULT NULL,
  p_mark_sent boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_line_item RECORD;
  v_work_order RECORD;
  v_employee RECORD;
  v_punch_in_time timestamptz;
  v_punch_out_time timestamptz;
  v_time_entry_id uuid;
  v_hours numeric;
  v_employee_id uuid;
BEGIN
  -- Fetch line item with related task and work order info
  SELECT
    woli.id,
    woli.line_type,
    woli.description,
    woli.quantity,
    woli.assigned_employee_id,
    woli.time_entry_sent_at,
    woli.task_id,
    wot.work_order_id,
    wot.task_name,
    wo.work_order_number,
    wo.yacht_id,
    wo.company_id
  INTO v_line_item
  FROM work_order_line_items woli
  LEFT JOIN work_order_tasks wot ON wot.id = woli.task_id
  LEFT JOIN work_orders wo ON wo.id = wot.work_order_id
  WHERE woli.id = p_line_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Line item not found');
  END IF;

  -- Validate labor line
  IF v_line_item.line_type != 'labor' THEN
    RETURN json_build_object('success', false, 'error', 'Only labor line items can be sent to the time clock');
  END IF;

  -- Determine employee
  v_employee_id := COALESCE(p_employee_override, v_line_item.assigned_employee_id);

  IF v_employee_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No employee assigned to this line item');
  END IF;

  -- Only block double-send when not using an override (standard single-employee path)
  IF p_employee_override IS NULL AND p_hours_override IS NULL AND v_line_item.time_entry_sent_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Hours for this line item have already been sent to the time clock');
  END IF;

  -- Determine hours to use
  v_hours := COALESCE(NULLIF(p_hours_override, 0), v_line_item.quantity);

  -- Validate hours
  IF v_hours <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hours must be greater than zero');
  END IF;

  -- Get employee name for notes
  SELECT first_name || ' ' || last_name INTO v_employee
  FROM user_profiles
  WHERE user_id = v_employee_id;

  -- Calculate punch times based on work date
  v_punch_in_time := p_work_date::timestamptz + interval '8 hours';
  v_punch_out_time := v_punch_in_time + (v_hours || ' hours')::interval;

  -- Create the time entry
  INSERT INTO staff_time_entries (
    user_id,
    work_order_id,
    yacht_id,
    company_id,
    punch_in_time,
    punch_out_time,
    reference_id,
    reference_type,
    notes,
    is_edited,
    edited_by
  ) VALUES (
    v_employee_id,
    v_line_item.work_order_id,
    v_line_item.yacht_id,
    v_line_item.company_id,
    v_punch_in_time,
    v_punch_out_time,
    v_line_item.id,
    'work_order_line_item',
    format('Work Order #%s - Task: %s - %s (%s hrs)',
      v_line_item.work_order_number,
      v_line_item.task_name,
      v_line_item.description,
      ROUND(v_hours, 2)
    ),
    (p_created_by IS NOT NULL),
    p_created_by
  )
  RETURNING id INTO v_time_entry_id;

  -- Mark line item as sent only when requested (default true for backwards compat)
  IF p_mark_sent THEN
    UPDATE work_order_line_items
    SET
      time_entry_sent_at = now(),
      time_entry_id = v_time_entry_id
    WHERE id = p_line_item_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'time_entry_id', v_time_entry_id,
    'hours', v_hours,
    'work_order_number', v_line_item.work_order_number
  );
END;
$function$;
