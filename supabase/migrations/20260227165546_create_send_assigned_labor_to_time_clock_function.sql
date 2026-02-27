/*
  # Create Function: Send Assigned Labor Hours to Time Clock

  ## Overview
  Sends the hours from a specific labor line item (with an assigned employee) to the
  time clock system as a staff_time_entries record. Enforces one-time-send protection
  to prevent employees from being paid twice for the same work.

  ## Function: send_assigned_labor_to_time_clock

  ### Parameters
  - `p_line_item_id` (uuid) — The work_order_line_items record to send
  - `p_work_date` (date) — The date to use for the time entry (defaults to today)
  - `p_created_by` (uuid, optional) — The user initiating the send

  ### Logic
  1. Fetches the line item and validates:
     - Must be a labor line (line_type = 'labor')
     - Must have an assigned_employee_id set
     - Must NOT already have time_entry_sent_at set (prevents double-send)
     - Must have quantity > 0
  2. Creates a staff_time_entries record for the assigned employee
  3. Updates the line item with time_entry_sent_at and time_entry_id

  ### Returns JSON
  - success: true/false
  - time_entry_id: the created entry id
  - employee_name: the employee's name
  - hours: hours sent
  - error: error message if failed

  ## Security
  - SECURITY DEFINER so it can update the line item and insert time entries
  - Only authenticated users can execute
*/

CREATE OR REPLACE FUNCTION send_assigned_labor_to_time_clock(
  p_line_item_id uuid,
  p_work_date date DEFAULT CURRENT_DATE,
  p_created_by uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_line_item RECORD;
  v_work_order RECORD;
  v_employee RECORD;
  v_punch_in_time timestamptz;
  v_punch_out_time timestamptz;
  v_time_entry_id uuid;
  v_result json;
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

  -- Validate assigned employee
  IF v_line_item.assigned_employee_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No employee assigned to this line item');
  END IF;

  -- Prevent double-send
  IF v_line_item.time_entry_sent_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Hours for this line item have already been sent to the time clock');
  END IF;

  -- Validate hours
  IF v_line_item.quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hours must be greater than zero');
  END IF;

  -- Get employee name for notes
  SELECT first_name || ' ' || last_name INTO v_employee
  FROM user_profiles
  WHERE user_id = v_line_item.assigned_employee_id;

  -- Calculate punch times based on work date
  v_punch_in_time := p_work_date::timestamptz + interval '8 hours';
  v_punch_out_time := v_punch_in_time + (v_line_item.quantity || ' hours')::interval;

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
    v_line_item.assigned_employee_id,
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
      ROUND(v_line_item.quantity, 2)
    ),
    (p_created_by IS NOT NULL),
    p_created_by
  )
  RETURNING id INTO v_time_entry_id;

  -- Mark line item as sent (prevents double-send)
  UPDATE work_order_line_items
  SET
    time_entry_sent_at = now(),
    time_entry_id = v_time_entry_id
  WHERE id = p_line_item_id;

  RETURN json_build_object(
    'success', true,
    'time_entry_id', v_time_entry_id,
    'hours', v_line_item.quantity,
    'work_order_number', v_line_item.work_order_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_assigned_labor_to_time_clock(uuid, date, uuid) TO authenticated;
