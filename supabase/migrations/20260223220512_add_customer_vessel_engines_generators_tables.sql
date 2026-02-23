/*
  # Add Customer Vessel Engines and Generators Tables

  ## Summary
  Creates two relational tables to track engines and generators on customer vessels
  in the customer management system, mirroring the yacht_engines/yacht_generators
  pattern used for marina yachts.

  ## New Tables

  ### customer_vessel_engines
  - `id` - UUID primary key
  - `vessel_id` - FK to customer_vessels
  - `label` - Display name (e.g. "Port Engine", "Starboard Engine")
  - `description` - Engine make/model description
  - `season_start_hours` - Numeric hours recorded at start of season
  - `sort_order` - Display ordering
  - `company_id` - FK to companies for multi-tenant isolation
  - `created_at`, `updated_at`

  ### customer_vessel_generators
  - `id` - UUID primary key
  - `vessel_id` - FK to customer_vessels
  - `label` - Display name (e.g. "Port Generator", "Starboard Generator")
  - `description` - Generator make/model description
  - `season_start_hours` - Numeric hours recorded at start of season
  - `sort_order` - Display ordering
  - `company_id` - FK to companies for multi-tenant isolation
  - `created_at`, `updated_at`

  ## Security
  - RLS enabled on both tables
  - Staff, master, and manager roles can insert/update/delete
  - Authenticated users can view
*/

CREATE TABLE IF NOT EXISTS customer_vessel_engines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES customer_vessels(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  season_start_hours numeric(10, 1),
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_vessel_generators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES customer_vessels(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  season_start_hours numeric(10, 1),
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_vessel_engines_vessel_id ON customer_vessel_engines(vessel_id);
CREATE INDEX IF NOT EXISTS idx_customer_vessel_generators_vessel_id ON customer_vessel_generators(vessel_id);
CREATE INDEX IF NOT EXISTS idx_customer_vessel_engines_company_id ON customer_vessel_engines(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_vessel_generators_company_id ON customer_vessel_generators(company_id);

ALTER TABLE customer_vessel_engines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vessel_generators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customer vessel engines"
  ON customer_vessel_engines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and master can insert customer vessel engines"
  ON customer_vessel_engines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff and master can update customer vessel engines"
  ON customer_vessel_engines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff and master can delete customer vessel engines"
  ON customer_vessel_engines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Authenticated users can view customer vessel generators"
  ON customer_vessel_generators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and master can insert customer vessel generators"
  ON customer_vessel_generators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff and master can update customer vessel generators"
  ON customer_vessel_generators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff and master can delete customer vessel generators"
  ON customer_vessel_generators FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'manager', 'mechanic')
    )
  );
