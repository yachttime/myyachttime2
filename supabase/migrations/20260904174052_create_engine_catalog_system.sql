/*
# Create Engine Catalog System

1. New Tables
- `engine_catalog` — Master catalog of reusable engine, generator, and outboard models with all service parts pre-filled.
  - `id` (uuid, primary key)
  - `model_name` (text, not null) — e.g. "C18 ACERT"
  - `manufacturer` (text) — e.g. "Caterpillar"
  - `equipment_type` (text, not null) — 'engine' or 'generator' (outboards are engines)
  - `description` (text) — e.g. "Cat C18 1000HP"
  - `fuel_type` (text, default 'diesel') — 'diesel' or 'gas'
  - All service part fields: oil_filter, fuel_filter, impeller, belts, oil weight/quantity, spark plugs, ignition parts, alt part numbers, include-in-full-service checkboxes — same layout as yacht_engines/yacht_generators
  - `company_id` (uuid, references companies) — for multi-tenant isolation
  - `created_at`, `updated_at` (timestamps)

2. Modified Tables
- `yacht_engines` — add optional `catalog_id` (uuid, references engine_catalog, nullable, ON DELETE SET NULL)
- `yacht_generators` — add optional `catalog_id` (uuid, references engine_catalog, nullable, ON DELETE SET NULL)
- `customer_vessel_engines` — add optional `catalog_id` (uuid, references engine_catalog, nullable, ON DELETE SET NULL)
- `customer_vessel_generators` — add optional `catalog_id` (uuid, references engine_catalog, nullable, ON DELETE SET NULL)

3. Security
- Enable RLS on `engine_catalog`.
- All authenticated users can SELECT (browse) catalog entries.
- Only staff, mechanic, manager, and master roles can INSERT, UPDATE, DELETE (using is_staff() helper).
*/

CREATE TABLE IF NOT EXISTS engine_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  manufacturer text,
  equipment_type text NOT NULL DEFAULT 'engine',
  description text,
  fuel_type text NOT NULL DEFAULT 'diesel',
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,

  -- Service parts — same layout as yacht_engines/yacht_generators
  oil_filter_part_number text DEFAULT '',
  oil_filter_alt1 text DEFAULT '',
  oil_filter_alt2 text DEFAULT '',
  fuel_filter_part_number text DEFAULT '',
  fuel_filter_alt1 text DEFAULT '',
  fuel_filter_alt2 text DEFAULT '',
  impeller_part_number text DEFAULT '',
  impeller_alt1 text DEFAULT '',
  impeller_alt2 text DEFAULT '',
  belt1_part_number text DEFAULT '',
  belt1_alt1 text DEFAULT '',
  belt1_alt2 text DEFAULT '',
  belt2_part_number text DEFAULT '',
  belt2_alt1 text DEFAULT '',
  belt2_alt2 text DEFAULT '',
  oil_weight text DEFAULT '',
  oil_quantity text DEFAULT '',
  spark_plug_part_number text DEFAULT '',
  distributor_cap_part_number text DEFAULT '',
  rotor_part_number text DEFAULT '',
  plug_wires_part_number text DEFAULT '',

  -- Include-in-full-service flags
  include_oil_filter boolean DEFAULT true,
  include_fuel_filter boolean DEFAULT true,
  include_impeller boolean DEFAULT true,
  include_belt1 boolean DEFAULT true,
  include_belt2 boolean DEFAULT true,
  include_spark_plug boolean DEFAULT true,
  include_distributor_cap boolean DEFAULT true,
  include_rotor boolean DEFAULT true,
  include_plug_wires boolean DEFAULT true,
  include_oil_weight boolean DEFAULT true,
  include_oil_quantity boolean DEFAULT true,
  include_oil_filter_alt1 boolean DEFAULT true,
  include_oil_filter_alt2 boolean DEFAULT true,
  include_fuel_filter_alt1 boolean DEFAULT true,
  include_fuel_filter_alt2 boolean DEFAULT true,
  include_impeller_alt1 boolean DEFAULT true,
  include_impeller_alt2 boolean DEFAULT true,
  include_belt1_alt1 boolean DEFAULT true,
  include_belt1_alt2 boolean DEFAULT true,
  include_belt2_alt1 boolean DEFAULT true,
  include_belt2_alt2 boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE engine_catalog ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can browse the catalog
DROP POLICY IF EXISTS "select_engine_catalog" ON engine_catalog;
CREATE POLICY "select_engine_catalog"
  ON engine_catalog FOR SELECT
  TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: only staff roles
DROP POLICY IF EXISTS "insert_engine_catalog" ON engine_catalog;
CREATE POLICY "insert_engine_catalog"
  ON engine_catalog FOR INSERT
  TO authenticated WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "update_engine_catalog" ON engine_catalog;
CREATE POLICY "update_engine_catalog"
  ON engine_catalog FOR UPDATE
  TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "delete_engine_catalog" ON engine_catalog;
CREATE POLICY "delete_engine_catalog"
  ON engine_catalog FOR DELETE
  TO authenticated USING (public.is_staff(auth.uid()));

-- Add catalog_id to vessel engine/generator tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_engines' AND column_name = 'catalog_id') THEN
    ALTER TABLE yacht_engines ADD COLUMN catalog_id uuid REFERENCES engine_catalog(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yacht_generators' AND column_name = 'catalog_id') THEN
    ALTER TABLE yacht_generators ADD COLUMN catalog_id uuid REFERENCES engine_catalog(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_engines' AND column_name = 'catalog_id') THEN
    ALTER TABLE customer_vessel_engines ADD COLUMN catalog_id uuid REFERENCES engine_catalog(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_vessel_generators' AND column_name = 'catalog_id') THEN
    ALTER TABLE customer_vessel_generators ADD COLUMN catalog_id uuid REFERENCES engine_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for equipment_type filtering
CREATE INDEX IF NOT EXISTS idx_engine_catalog_equipment_type ON engine_catalog(equipment_type);
CREATE INDEX IF NOT EXISTS idx_engine_catalog_company_id ON engine_catalog(company_id);
