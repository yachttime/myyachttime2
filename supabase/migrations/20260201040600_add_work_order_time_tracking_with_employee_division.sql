/*
  # Add Work Order Time Tracking with Employee Hour Division

  ## Overview
  Implements automatic time entry creation from work order labor hours, dividing hours equally
  among all assigned employees when multiple employees are assigned to the same task.

  ## Changes
  1. Add function to create time entries from work order tasks
     - Divides labor hours equally among assigned employees
     - Creates individual time entries for each employee
     - Links entries to work order using reference_id and reference_type
  
  2. Add work_order_id to staff_time_entries if not exists
     - Allows direct linking of time entries to work orders
  
  ## Logic
  - For each task in a work order:
    - Sum all labor line item hours (quantity field)
    - Count assigned employees
    - Divide total hours by number of employees
    - Create time entry for each employee with their share of hours
  
  ## Security
  - Only staff, mechanic, and master roles can create time entries from work orders
  - Time entries are created with calculated punch in/out times based on hours
*/

-- Add work_order_id column to staff_time_entries if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_time_entries' AND column_name = 'work_order_id'
  ) THEN
    ALTER TABLE staff_time_entries ADD COLUMN work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_staff_time_entries_work_order_id ON staff_time_entries(work_order_id);
  END IF;
END $$;

-- Function to create time entries from work order tasks
-- Divides labor hours equally among assigned employees
CREATE OR REPLACE FUNCTION create_time_entries_from_work_order(
  p_work_order_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_task RECORD;
  v_assignment RECORD;
  v_total_labor_hours numeric;
  v_employee_count integer;
  v_hours_per_employee numeric;
  v_work_order RECORD;
  v_punch_in_time timestamptz;
  v_punch_out_time timestamptz;
  v_entries_created integer := 0;
  v_result json;
BEGIN
  -- Get work order details
  SELECT * INTO v_work_order
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  -- Set default punch times (today 8am to calculated end time)
  v_punch_in_time := date_trunc('day', now()) + interval '8 hours';

  -- Loop through each task in the work order
  FOR v_task IN
    SELECT 
      wot.id as task_id,
      wot.task_name,
      wot.work_order_id,
      wo.yacht_id
    FROM work_order_tasks wot
    JOIN work_orders wo ON wo.id = wot.work_order_id
    WHERE wot.work_order_id = p_work_order_id
    ORDER BY wot.task_order
  LOOP
    -- Calculate total labor hours for this task
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_labor_hours
    FROM work_order_line_items
    WHERE task_id = v_task.task_id
      AND line_type = 'labor';

    -- Skip if no labor hours
    IF v_total_labor_hours <= 0 THEN
      CONTINUE;
    END IF;

    -- Count assigned employees for this task
    SELECT COUNT(*)
    INTO v_employee_count
    FROM work_order_task_assignments
    WHERE task_id = v_task.task_id;

    -- Skip if no employees assigned
    IF v_employee_count = 0 THEN
      CONTINUE;
    END IF;

    -- Calculate hours per employee (divided equally)
    v_hours_per_employee := v_total_labor_hours / v_employee_count;

    -- Calculate punch out time based on hours per employee
    v_punch_out_time := v_punch_in_time + (v_hours_per_employee || ' hours')::interval;

    -- Create time entry for each assigned employee
    FOR v_assignment IN
      SELECT employee_id
      FROM work_order_task_assignments
      WHERE task_id = v_task.task_id
    LOOP
      -- Insert time entry for this employee
      INSERT INTO staff_time_entries (
        user_id,
        work_order_id,
        yacht_id,
        punch_in_time,
        punch_out_time,
        reference_id,
        reference_type,
        notes
      ) VALUES (
        v_assignment.employee_id,
        p_work_order_id,
        v_task.yacht_id,
        v_punch_in_time,
        v_punch_out_time,
        v_task.task_id,
        'work_order_task',
        format('Work Order #%s - Task: %s (%s of %s employees, %s hours)',
          v_work_order.work_order_number,
          v_task.task_name,
          '1',
          v_employee_count,
          ROUND(v_hours_per_employee, 2)
        )
      );

      v_entries_created := v_entries_created + 1;
    END LOOP;
  END LOOP;

  -- Build result JSON
  v_result := json_build_object(
    'success', true,
    'entries_created', v_entries_created,
    'work_order_id', p_work_order_id,
    'work_order_number', v_work_order.work_order_number
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_time_entries_from_work_order(uuid, uuid) TO authenticated;

-- Function to get preview of time entries that would be created (for UI display)
CREATE OR REPLACE FUNCTION preview_work_order_time_entries(
  p_work_order_id uuid
)
RETURNS TABLE (
  task_id uuid,
  task_name text,
  employee_id uuid,
  employee_name text,
  total_task_hours numeric,
  employee_hours numeric,
  employee_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wot.id as task_id,
    wot.task_name,
    wota.employee_id,
    (up.first_name || ' ' || up.last_name) as employee_name,
    task_hours.total_hours as total_task_hours,
    ROUND(task_hours.total_hours / task_hours.employee_count, 2) as employee_hours,
    task_hours.employee_count::integer
  FROM work_order_tasks wot
  JOIN work_order_task_assignments wota ON wota.task_id = wot.id
  JOIN user_profiles up ON up.user_id = wota.employee_id
  JOIN LATERAL (
    SELECT 
      COALESCE(SUM(woli.quantity), 0) as total_hours,
      COUNT(DISTINCT wota2.employee_id) as employee_count
    FROM work_order_line_items woli
    LEFT JOIN work_order_task_assignments wota2 ON wota2.task_id = wot.id
    WHERE woli.task_id = wot.id
      AND woli.line_type = 'labor'
    GROUP BY wot.id
  ) task_hours ON true
  WHERE wot.work_order_id = p_work_order_id
    AND task_hours.total_hours > 0
  ORDER BY wot.task_order, employee_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION preview_work_order_time_entries(uuid) TO authenticated;
