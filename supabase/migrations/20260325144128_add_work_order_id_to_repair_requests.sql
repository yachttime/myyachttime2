/*
  # Add work_order_id to repair_requests

  ## Summary
  Adds a `work_order_id` foreign key column to the `repair_requests` table so that
  when a work order is sent to admin, the repair request can be linked back to the
  originating work order. This prevents duplicate repair requests from being created
  when both an estimate AND its derived work order are both sent to admin for the
  same job.

  ## Changes
  - `repair_requests`: adds `work_order_id` (uuid, nullable FK → work_orders)

  ## Notes
  - Nullable so existing records are unaffected
  - The application logic will use this to detect an existing repair request before
    creating a new one when a work order is sent to admin
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'work_order_id'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repair_requests_work_order_id ON repair_requests(work_order_id);
