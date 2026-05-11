/*
  # Add repair_request to daily_tasks task_type check constraint

  Extends the allowed values for task_type in daily_tasks to include 'repair_request',
  enabling repair requests to be sent directly to the daily task list.
*/

ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_task_type_check;

ALTER TABLE daily_tasks ADD CONSTRAINT daily_tasks_task_type_check
  CHECK (task_type = ANY (ARRAY['manual'::text, 'appointment'::text, 'repair_request'::text]));
