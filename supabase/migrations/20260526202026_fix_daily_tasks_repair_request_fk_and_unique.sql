/*
  # Fix daily_tasks repair_request_id FK and add unique constraint

  The FK reference to repair_requests was silently blocking inserts because
  RLS on repair_requests prevents the FK check from resolving. We drop the FK
  and keep the column as a plain UUID. We also add a unique constraint so the
  same repair request can only be sent to daily tasks once at the DB level.

  ## Changes
  - Drop FK constraint daily_tasks_repair_request_id_fkey
  - Add UNIQUE constraint on repair_request_id (excluding NULLs automatically)
*/

ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_repair_request_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_repair_request_id_unique
  ON daily_tasks (repair_request_id)
  WHERE repair_request_id IS NOT NULL;
