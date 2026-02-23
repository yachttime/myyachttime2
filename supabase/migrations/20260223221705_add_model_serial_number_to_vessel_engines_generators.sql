/*
  # Add Model Number and Serial Number to Customer Vessel Engines and Generators

  ## Summary
  Replaces the generic `description` field with dedicated `model_number` and `serial_number`
  fields on both customer_vessel_engines and customer_vessel_generators tables.
  The original `description` column is kept for backward compatibility but new records
  will use model_number and serial_number.

  ## Changes
  - customer_vessel_engines: add `model_number` (text), `serial_number` (text)
  - customer_vessel_generators: add `model_number` (text), `serial_number` (text)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_vessel_engines' AND column_name = 'model_number'
  ) THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN model_number text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_vessel_engines' AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN serial_number text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_vessel_generators' AND column_name = 'model_number'
  ) THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN model_number text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_vessel_generators' AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN serial_number text NOT NULL DEFAULT '';
  END IF;
END $$;
