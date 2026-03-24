/*
  # Add gate_code to customer_vessels

  Adds an optional gate_code field to the customer_vessels table so staff can
  record marina or storage gate access codes alongside vessel information.

  1. Changes
    - `customer_vessels` - new nullable text column `gate_code`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_vessels' AND column_name = 'gate_code'
  ) THEN
    ALTER TABLE customer_vessels ADD COLUMN gate_code text;
  END IF;
END $$;
