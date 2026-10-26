/*
# Create Yacht Budget Items Table

1. Overview
  - Adds a child table to yacht_budgets that stores the individual line items
    that make up a built budget (estimate packages and off-season estimates).
  - Each line item records its source (package or off-season estimate), a
    display name, and the dollar amount it contributes to the budget total.
  - Enables the "Build a Budget" flow where a manager assembles a yearly
    budget by pulling real costs from estimating packages and existing
    off-season estimates, with a clear breakdown of what each item contributes.

2. New Tables
  - `yacht_budget_items`
    - `id` (uuid, primary key)
    - `budget_id` (uuid, foreign key to yacht_budgets, ON DELETE CASCADE)
    - `yacht_id` (uuid, foreign key to yachts) - denormalized for easy RLS
    - `item_type` (text) - 'package' or 'offseason_estimate'
    - `source_id` (uuid) - references estimate_packages.id or estimates.id
    - `name` (text) - display name shown in the budget breakdown
    - `amount` (numeric(10,2)) - dollar amount this line contributes
    - `created_at` (timestamptz)

3. Security
  - Enable RLS on yacht_budget_items.
  - Managers can view/insert/update/delete items for their assigned yacht.
  - Staff and masters can view/insert/update/delete items for any yacht.
  - Grant SELECT, INSERT, UPDATE, DELETE to authenticated.
*/

CREATE TABLE IF NOT EXISTS yacht_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES yacht_budgets(id) ON DELETE CASCADE NOT NULL,
  yacht_id uuid REFERENCES yachts(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('package', 'offseason_estimate')),
  source_id uuid,
  name text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE yacht_budget_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_yacht_budget_items_budget_id ON yacht_budget_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_yacht_budget_items_yacht_id ON yacht_budget_items(yacht_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON yacht_budget_items TO authenticated;

DROP POLICY IF EXISTS "Managers can view own yacht budget items" ON yacht_budget_items;
CREATE POLICY "Managers can view own yacht budget items"
  ON yacht_budget_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budget_items.yacht_id
    )
  );

DROP POLICY IF EXISTS "Staff and master can view all budget items" ON yacht_budget_items;
CREATE POLICY "Staff and master can view all budget items"
  ON yacht_budget_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

DROP POLICY IF EXISTS "Managers can insert own yacht budget items" ON yacht_budget_items;
CREATE POLICY "Managers can insert own yacht budget items"
  ON yacht_budget_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budget_items.yacht_id
    )
  );

DROP POLICY IF EXISTS "Staff and master can insert all budget items" ON yacht_budget_items;
CREATE POLICY "Staff and master can insert all budget items"
  ON yacht_budget_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

DROP POLICY IF EXISTS "Managers can update own yacht budget items" ON yacht_budget_items;
CREATE POLICY "Managers can update own yacht budget items"
  ON yacht_budget_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budget_items.yacht_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budget_items.yacht_id
    )
  );

DROP POLICY IF EXISTS "Staff and master can update all budget items" ON yacht_budget_items;
CREATE POLICY "Staff and master can update all budget items"
  ON yacht_budget_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

DROP POLICY IF EXISTS "Managers can delete own yacht budget items" ON yacht_budget_items;
CREATE POLICY "Managers can delete own yacht budget items"
  ON yacht_budget_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budget_items.yacht_id
    )
  );

DROP POLICY IF EXISTS "Staff and master can delete all budget items" ON yacht_budget_items;
CREATE POLICY "Staff and master can delete all budget items"
  ON yacht_budget_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );
