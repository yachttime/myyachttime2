/*
# Add Trip Inspection Link to Estimating Pipeline

1. Modified Tables
   - `estimates`: Added `trip_inspection_id` (uuid, nullable) FK to trip_inspections
   - `work_orders`: Added `trip_inspection_id` (uuid, nullable) FK to trip_inspections
   - `estimating_invoices`: Added `trip_inspection_id` (uuid, nullable) FK to trip_inspections

2. Indexes
   - Added index on estimates.trip_inspection_id
   - Added index on work_orders.trip_inspection_id
   - Added index on estimating_invoices.trip_inspection_id

3. Purpose
   - Allows staff to attach a trip inspection to an estimate when billing a customer
   - The trip_inspection_id carries through the pipeline: estimate -> work order -> invoice
   - When printing any of these documents, the full trip inspection report is appended

4. Notes
   - One inspection per estimate (one-to-one relationship)
   - The link is nullable since not all estimates need an inspection attached
   - Foreign keys reference trip_inspections(id) with ON DELETE SET NULL
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'trip_inspection_id'
  ) THEN
    ALTER TABLE estimates ADD COLUMN trip_inspection_id uuid REFERENCES trip_inspections(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'trip_inspection_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN trip_inspection_id uuid REFERENCES trip_inspections(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimating_invoices' AND column_name = 'trip_inspection_id'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN trip_inspection_id uuid REFERENCES trip_inspections(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estimates_trip_inspection_id ON estimates(trip_inspection_id) WHERE trip_inspection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_trip_inspection_id ON work_orders(trip_inspection_id) WHERE trip_inspection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_trip_inspection_id ON estimating_invoices(trip_inspection_id) WHERE trip_inspection_id IS NOT NULL;