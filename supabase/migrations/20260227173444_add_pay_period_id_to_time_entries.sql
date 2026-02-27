/*
  # Add pay_period_id to staff_time_entries

  ## Summary
  Links time entries to a pay period so we can track when employees were paid.

  ## Changes
  - `staff_time_entries`: Add `pay_period_id` (nullable FK to pay_periods)
  - Index on `pay_period_id` for fast lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_time_entries' AND column_name = 'pay_period_id'
  ) THEN
    ALTER TABLE staff_time_entries
      ADD COLUMN pay_period_id uuid REFERENCES pay_periods(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_time_entries_pay_period_id
  ON staff_time_entries(pay_period_id);
