/*
  # Add work_order_task_id to daily_tasks

  ## Summary
  Links daily tasks back to their originating work order tasks in the estimating system.

  ## Changes
  - `daily_tasks` table: adds nullable `work_order_task_id` (uuid, FK to work_order_tasks)

  ## Purpose
  When a work order task is sent to Daily Tasks, this column stores the reference.
  On completion of the daily task, the assigned employee is pushed back to the
  work order task's assigned employees list.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_tasks' AND column_name = 'work_order_task_id'
  ) THEN
    ALTER TABLE daily_tasks
      ADD COLUMN work_order_task_id uuid REFERENCES work_order_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_work_order_task_id ON daily_tasks(work_order_task_id);
