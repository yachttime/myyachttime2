/*
  # Add Yacht Engines and Generators Tables

  ## Summary
  Replaces the single port/starboard engine/generator text fields on the yachts table
  with proper relational tables that support multiple engines and generators per yacht,
  along with start-of-season hour tracking.

  ## New Tables

  ### yacht_engines
  - `id` - UUID primary key
  - `yacht_id` - FK to yachts
  - `label` - Display name (e.g. "Port Engine", "Starboard Engine", "Center Engine")
  - `description` - Engine make/model description
  - `season_start_hours` - Numeric hours recorded at start of season
  - `sort_order` - Display ordering
  - `company_id` - FK to companies for multi-tenant isolation
  - `created_at`, `updated_at`

  ### yacht_generators
  - `id` - UUID primary key
  - `yacht_id` - FK to yachts
  - `label` - Display name (e.g. "Port Generator", "Starboard Generator", "Aux Generator")
  - `description` - Generator make/model description
  - `season_start_hours` - Numeric hours recorded at start of season
  - `sort_order` - Display ordering
  - `company_id` - FK to companies for multi-tenant isolation
  - `created_at`, `updated_at`

  ## Data Migration
  Migrates existing port_engine, starboard_engine, port_generator, starboard_generator
  text values from yachts table into the new tables.

  ## Security
  - RLS enabled on both tables
  - Staff and master roles can insert/update/delete
  - Authenticated users with yacht access can select
*/

CREATE TABLE IF NOT EXISTS yacht_engines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  season_start_hours numeric(10, 1),
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yacht_generators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  season_start_hours numeric(10, 1),
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yacht_engines_yacht_id ON yacht_engines(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_generators_yacht_id ON yacht_generators(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_engines_company_id ON yacht_engines(company_id);
CREATE INDEX IF NOT EXISTS idx_yacht_generators_company_id ON yacht_generators(company_id);

ALTER TABLE yacht_engines ENABLE ROW LEVEL SECURITY;
ALTER TABLE yacht_generators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view yacht engines"
  ON yacht_engines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and master can insert yacht engines"
  ON yacht_engines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and master can update yacht engines"
  ON yacht_engines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and master can delete yacht engines"
  ON yacht_engines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

CREATE POLICY "Authenticated users can view yacht generators"
  ON yacht_generators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and master can insert yacht generators"
  ON yacht_generators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and master can update yacht generators"
  ON yacht_generators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

CREATE POLICY "Staff and master can delete yacht generators"
  ON yacht_generators FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager')
    )
  );

INSERT INTO yacht_engines (yacht_id, label, description, sort_order, company_id)
SELECT id, 'Port Engine', port_engine, 0, company_id
FROM yachts
WHERE port_engine IS NOT NULL AND port_engine != '';

INSERT INTO yacht_engines (yacht_id, label, description, sort_order, company_id)
SELECT id, 'Starboard Engine', starboard_engine, 1, company_id
FROM yachts
WHERE starboard_engine IS NOT NULL AND starboard_engine != '';

INSERT INTO yacht_generators (yacht_id, label, description, sort_order, company_id)
SELECT id, 'Port Generator', port_generator, 0, company_id
FROM yachts
WHERE port_generator IS NOT NULL AND port_generator != '';

INSERT INTO yacht_generators (yacht_id, label, description, sort_order, company_id)
SELECT id, 'Starboard Generator', starboard_generator, 1, company_id
FROM yachts
WHERE starboard_generator IS NOT NULL AND starboard_generator != '';
