/*
  # Fix Time Entries - Skip Employees Already Paid (Drop & Recreate)

  ## Overview
  Drops and recreates both time entry functions to add paid/existing entry detection.

  ## Changes

  ### preview_work_order_time_entries
  - Added `already_has_entry` (boolean): true if time entry already exists
  - Added `is_paid` (boolean): true if existing entry is in a processed pay period

  ### create_time_entries_from_work_order
  - Skips employees who already have a time entry for this work order's tasks
  - Returns `entries_skipped` count in result
*/

DROP FUNCTION IF EXISTS preview_work_order_time_entries(uuid);
DROP FUNCTION IF EXISTS create_time_entries_from_work_order(uuid, uuid);

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
  employee_count integer,
  already_has_entry boolean,
  is_paid boolean
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
    task_hours.employee_count::integer,
    EXISTS (
      SELECT 1 FROM staff_time_entries ste
      WHERE ste.work_order_id = p_work_order_id
        AND ste.user_id = wota.employee_id
        AND ste.reference_id = wot.id
        AND ste.reference_type = 'work_order_task'
    ) as already_has_entry,
    EXISTS (
      SELECT 1 FROM staff_time_entries ste
      JOIN pay_periods pp ON pp.id = ste.pay_period_id
      WHERE ste.work_order_id = p_work_order_id
        AND ste.user_id = wota.employee_id
        AND pp.is_processed = true
    ) as is_paid
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

GRANT EXECUTE ON FUNCTION preview_work_order_time_entries(uuid) TO authenticated;

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
  v_entries_skipped integer := 0;
  v_result json;
  v_already_exists boolean;
BEGIN
  SELECT * INTO v_work_order FROM work_orders WHERE id = p_work_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;

  v_punch_in_time := date_trunc('day', now()) + interval '8 hours';

  FOR v_task IN
    SELECT wot.id as task_id, wot.task_name, wot.work_order_id, wo.yacht_id
    FROM work_order_tasks wot
    JOIN work_orders wo ON wo.id = wot.work_order_id
    WHERE wot.work_order_id = p_work_order_id
    ORDER BY wot.task_order
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_labor_hours
    FROM work_order_line_items
    WHERE task_id = v_task.task_id AND line_type = 'labor';

    IF v_total_labor_hours <= 0 THEN CONTINUE; END IF;

    SELECT COUNT(*) INTO v_employee_count
    FROM work_order_task_assignments WHERE task_id = v_task.task_id;

    IF v_employee_count = 0 THEN CONTINUE; END IF;

    v_hours_per_employee := v_total_labor_hours / v_employee_count;
    v_punch_out_time := v_punch_in_time + (v_hours_per_employee || ' hours')::interval;

    FOR v_assignment IN
      SELECT employee_id FROM work_order_task_assignments WHERE task_id = v_task.task_id
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM staff_time_entries
        WHERE work_order_id = p_work_order_id
          AND user_id = v_assignment.employee_id
          AND reference_id = v_task.task_id
          AND reference_type = 'work_order_task'
      ) INTO v_already_exists;

      IF v_already_exists THEN
        v_entries_skipped := v_entries_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO staff_time_entries (
        user_id, work_order_id, yacht_id, punch_in_time, punch_out_time,
        reference_id, reference_type, notes
      ) VALUES (
        v_assignment.employee_id, p_work_order_id, v_task.yacht_id,
        v_punch_in_time, v_punch_out_time, v_task.task_id, 'work_order_task',
        format('Work Order #%s - Task: %s (%s hours, %s of %s employees)',
          v_work_order.work_order_number, v_task.task_name,
          ROUND(v_hours_per_employee, 2), '1', v_employee_count)
      );

      v_entries_created := v_entries_created + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'entries_created', v_entries_created,
    'entries_skipped', v_entries_skipped,
    'work_order_id', p_work_order_id,
    'work_order_number', v_work_order.work_order_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_time_entries_from_work_order(uuid, uuid) TO authenticated;
