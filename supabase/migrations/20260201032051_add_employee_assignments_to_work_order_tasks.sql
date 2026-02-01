/*
  # Add Employee Assignments to Work Order Tasks

  1. New Table
    - `work_order_task_assignments`
      - Tracks which employees are assigned to which work order tasks
      - Allows multiple employees per task
      - Links to user_profiles table

  2. Changes
    - Add status constraints to work_orders table for new statuses:
      - pending
      - waiting_for_parts
      - in_process
      - completed

  3. Security
    - Enable RLS on work_order_task_assignments
    - Staff, mechanic, and master roles can manage assignments
*/

-- Create work_order_task_assignments table
CREATE TABLE IF NOT EXISTS work_order_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES work_order_tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES user_profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, employee_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_task_assignments_task_id ON work_order_task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_work_order_task_assignments_employee_id ON work_order_task_assignments(employee_id);

-- Enable RLS
ALTER TABLE work_order_task_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_order_task_assignments

-- Staff, mechanic, and master can view all task assignments
CREATE POLICY "Staff can view all task assignments"
  ON work_order_task_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff, mechanic, and master can insert task assignments
CREATE POLICY "Staff can insert task assignments"
  ON work_order_task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff, mechanic, and master can delete task assignments
CREATE POLICY "Staff can delete task assignments"
  ON work_order_task_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Update work_orders status constraint to include new statuses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'work_orders_status_check'
    AND table_name = 'work_orders'
  ) THEN
    ALTER TABLE work_orders DROP CONSTRAINT work_orders_status_check;
  END IF;
END $$;

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_status_check
  CHECK (status IN ('pending', 'waiting_for_parts', 'in_process', 'completed'));
