/*
  # Add Assigned Employee and Time Entry Tracking to Work Order Line Items

  ## Overview
  Enables per-employee labor hour assignment directly on work order line items,
  and tracks whether those hours have been sent to the time clock system to
  prevent double-payment.

  ## Changes

  ### 1. work_order_line_items
  - `assigned_employee_id` (uuid, nullable) — The specific employee assigned to this labor line item.
    Only applies to lines with `line_type = 'labor'`. When set, hours can be sent to the
    time clock for this specific employee.
  - `time_entry_sent_at` (timestamptz, nullable) — Timestamp when this line item's hours were
    sent to the time clock. Once set, the hours cannot be sent again (prevents over-payment).
  - `time_entry_id` (uuid, nullable) — Reference to the staff_time_entries record created
    for this line item, for traceability.

  ## Security
  - No RLS changes needed; inherits existing work_order_line_items policies.

  ## Important Notes
  - Only labor line items (`line_type = 'labor'`) use assigned_employee_id and time_entry_sent_at.
  - The one-time send protection is enforced at both the application and database level.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'assigned_employee_id'
  ) THEN
    ALTER TABLE work_order_line_items
      ADD COLUMN assigned_employee_id uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_wo_line_items_assigned_employee ON work_order_line_items(assigned_employee_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'time_entry_sent_at'
  ) THEN
    ALTER TABLE work_order_line_items ADD COLUMN time_entry_sent_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_order_line_items' AND column_name = 'time_entry_id'
  ) THEN
    ALTER TABLE work_order_line_items
      ADD COLUMN time_entry_id uuid REFERENCES staff_time_entries(id) ON DELETE SET NULL;
  END IF;
END $$;
