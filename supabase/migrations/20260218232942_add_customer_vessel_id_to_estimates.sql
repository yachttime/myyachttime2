/*
  # Add customer_vessel_id to estimates

  ## Summary
  Adds a foreign key reference to customer_vessels on the estimates table so that
  walk-in (retail) customer estimates can track which vessel the work is for.

  ## Changes
  - `estimates`: new nullable column `customer_vessel_id` (uuid, FK → customer_vessels.id)

  ## Notes
  - Nullable so existing estimates are unaffected
  - No RLS changes needed; existing estimate policies cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'customer_vessel_id'
  ) THEN
    ALTER TABLE estimates ADD COLUMN customer_vessel_id uuid REFERENCES customer_vessels(id) ON DELETE SET NULL;
  END IF;
END $$;
