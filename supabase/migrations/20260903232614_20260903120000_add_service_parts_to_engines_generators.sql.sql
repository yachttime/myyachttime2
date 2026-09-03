/*
  # Add Service Part Numbers to Engines and Generators

  ## Summary
  Adds service part number fields to all four engine/generator tables so staff can
  quickly look up what oil filter, fuel filter, impeller, belts, oil type/quantity,
  and (for gas engines) ignition parts each engine or generator needs.

  ## New Columns (added to yacht_engines, yacht_generators, customer_vessel_engines, customer_vessel_generators)

  Common service parts (all engine/generator types):
  - fuel_type (text) - 'gas' or 'diesel', defaults to 'diesel'
  - oil_filter_part_number (text) - Factory oil filter part number
  - oil_filter_alt1 (text) - First alternate/cross-over oil filter part number
  - oil_filter_alt2 (text) - Second alternate/cross-over oil filter part number
  - fuel_filter_part_number (text) - Factory fuel filter part number
  - fuel_filter_alt1 (text) - First alternate/cross-over fuel filter part number
  - fuel_filter_alt2 (text) - Second alternate/cross-over fuel filter part number
  - impeller_part_number (text) - Impeller part number
  - belt1_part_number (text) - First belt part number (engines usually have two belts)
  - belt2_part_number (text) - Second belt part number
  - oil_weight (text) - Oil viscosity (e.g. "15W-40")
  - oil_quantity (text) - Oil capacity (e.g. "8 qts")

  Gas-engine-specific parts (nullable, only filled for gas engines):
  - spark_plug_part_number (text) - Spark plug part number
  - distributor_cap_part_number (text) - Distributor cap part number
  - rotor_part_number (text) - Rotor part number
  - plug_wires_part_number (text) - Plug wires part number

  Also adds model_number and serial_number to yacht_engines and yacht_generators
  (customer vessel tables already have these from a prior migration).

  ## Security
  No RLS policy changes needed — existing policies already cover all columns on these tables.
*/

-- Helper function to add a column if it doesn't exist
DO $$
BEGIN
  -- yacht_engines: add model_number and serial_number (not present yet)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'model_number') THEN
    ALTER TABLE yacht_engines ADD COLUMN model_number text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'serial_number') THEN
    ALTER TABLE yacht_engines ADD COLUMN serial_number text NOT NULL DEFAULT '';
  END IF;

  -- yacht_generators: add model_number and serial_number (not present yet)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'model_number') THEN
    ALTER TABLE yacht_generators ADD COLUMN model_number text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'serial_number') THEN
    ALTER TABLE yacht_generators ADD COLUMN serial_number text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add service part columns to all four tables
-- We use a DO block with a loop over the table names to keep this DRY.
DO $$
DECLARE
  tbl text;
  col text;
  service_cols text[] := ARRAY[
    'fuel_type', 'oil_filter_part_number', 'oil_filter_alt1', 'oil_filter_alt2',
    'fuel_filter_part_number', 'fuel_filter_alt1', 'fuel_filter_alt2',
    'impeller_part_number', 'belt1_part_number', 'belt2_part_number',
    'oil_weight', 'oil_quantity',
    'spark_plug_part_number', 'distributor_cap_part_number', 'rotor_part_number', 'plug_wires_part_number'
  ];
  tables text[] := ARRAY['yacht_engines', 'yacht_generators', 'customer_vessel_engines', 'customer_vessel_generators'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOREACH col IN ARRAY service_cols LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = tbl AND column_name = col
      ) THEN
        IF col = 'fuel_type' THEN
          EXECUTE format('ALTER TABLE %I ADD COLUMN %I text NOT NULL DEFAULT ''diesel''', tbl, col);
        ELSE
          EXECUTE format('ALTER TABLE %I ADD COLUMN %I text NOT NULL DEFAULT ''''', tbl, col);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;