/*
  # Add repair_request_id to daily_tasks

  Adds a nullable foreign key linking a daily task back to the repair request
  it was created from. This allows the UI to detect when a repair request has
  already been sent to the daily task list and prevent duplicates.

  ## Changes
  - `daily_tasks.repair_request_id` (uuid, nullable) — references repair_requests(id)
  - Index for fast lookups by repair_request_id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_tasks' AND column_name = 'repair_request_id'
  ) THEN
    ALTER TABLE daily_tasks ADD COLUMN repair_request_id uuid REFERENCES repair_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_repair_request_id ON daily_tasks(repair_request_id);
