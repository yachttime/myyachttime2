/*
# Add "Include in Full Service" Checkboxes to Engine/Generator Service Parts

## Summary
Adds a boolean column for each service part type on all four engine/generator tables
(yacht_engines, yacht_generators, customer_vessel_engines, customer_vessel_generators).
These columns let staff mark which parts should be included when running a "Quick Full Service"
from the Estimates screen. Previously every part was auto-included; now staff can pre-select
which ones apply to each specific engine/generator.

## New Columns (added to all 4 tables)
Each column defaults to TRUE so existing data is treated as "include everything" --
preserving the previous behavior until staff explicitly uncheck a part.

- include_oil_filter (boolean, default true)
- include_fuel_filter (boolean, default true)
- include_impeller (boolean, default true)
- include_belt1 (boolean, default true)
- include_belt2 (boolean, default true)
- include_spark_plug (boolean, default true)
- include_distributor_cap (boolean, default true)
- include_rotor (boolean, default true)
- include_plug_wires (boolean, default true)
- include_oil_weight (boolean, default true)
- include_oil_quantity (boolean, default true)

## Security
No RLS policy changes. Existing policies on these tables already control access.
*/

DO $$
BEGIN
  -- yacht_engines
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_oil_filter') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_oil_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_fuel_filter') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_fuel_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_impeller') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_impeller boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_belt1') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_belt1 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_belt2') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_belt2 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_spark_plug') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_spark_plug boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_distributor_cap') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_distributor_cap boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_rotor') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_rotor boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_plug_wires') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_plug_wires boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_oil_weight') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_oil_weight boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'include_oil_quantity') THEN
    ALTER TABLE yacht_engines ADD COLUMN include_oil_quantity boolean DEFAULT true;
  END IF;

  -- yacht_generators
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_oil_filter') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_oil_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_fuel_filter') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_fuel_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_impeller') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_impeller boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_belt1') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_belt1 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_belt2') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_belt2 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_spark_plug') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_spark_plug boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_distributor_cap') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_distributor_cap boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_rotor') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_rotor boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_plug_wires') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_plug_wires boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_oil_weight') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_oil_weight boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'include_oil_quantity') THEN
    ALTER TABLE yacht_generators ADD COLUMN include_oil_quantity boolean DEFAULT true;
  END IF;

  -- customer_vessel_engines
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_oil_filter') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_oil_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_fuel_filter') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_fuel_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_impeller') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_impeller boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_belt1') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_belt1 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_belt2') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_belt2 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_spark_plug') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_spark_plug boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_distributor_cap') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_distributor_cap boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_rotor') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_rotor boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_plug_wires') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_plug_wires boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_oil_weight') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_oil_weight boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'include_oil_quantity') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN include_oil_quantity boolean DEFAULT true;
  END IF;

  -- customer_vessel_generators
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_oil_filter') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_oil_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_fuel_filter') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_fuel_filter boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_impeller') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_impeller boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_belt1') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_belt1 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_belt2') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_belt2 boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_spark_plug') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_spark_plug boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_distributor_cap') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_distributor_cap boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_rotor') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_rotor boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_plug_wires') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_plug_wires boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_oil_weight') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_oil_weight boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'include_oil_quantity') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN include_oil_quantity boolean DEFAULT true;
  END IF;
END $$;