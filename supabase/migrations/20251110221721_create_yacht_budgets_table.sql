/*
  # Create Yacht Budgets Table

  1. Overview
    - Creates a table to track yearly budgets for each yacht
    - Allows managers and staff to set and view annual repair budgets
    - Enables budget tracking and remaining budget calculations

  2. New Tables
    - `yacht_budgets`
      - `id` (uuid, primary key) - Unique budget record identifier
      - `yacht_id` (uuid, foreign key) - Reference to yachts table
      - `budget_year` (integer) - Year this budget applies to
      - `budget_amount` (numeric) - Total budget amount for the year
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp
      - `created_by` (uuid) - User who created the budget
      - `updated_by` (uuid) - User who last updated the budget

  3. Constraints
    - Unique constraint on yacht_id and budget_year combination
    - Ensures only one budget per yacht per year

  4. Security
    - Enable RLS on yacht_budgets table
    - Allow managers to view and update budget for their assigned yacht
    - Allow staff to view and manage all yacht budgets

  5. Indexes
    - Index on yacht_id for efficient yacht-based queries
    - Composite index on yacht_id and budget_year for lookups
*/

-- Create yacht_budgets table
CREATE TABLE IF NOT EXISTS yacht_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  budget_year integer NOT NULL,
  budget_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(yacht_id, budget_year)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_yacht_id ON yacht_budgets(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_yacht_year ON yacht_budgets(yacht_id, budget_year);

-- Enable Row Level Security
ALTER TABLE yacht_budgets ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can view budget for their assigned yacht
CREATE POLICY "Managers can view own yacht budget"
  ON yacht_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budgets.yacht_id
    )
  );

-- Policy: Staff can view all budgets
CREATE POLICY "Staff can view all budgets"
  ON yacht_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- Policy: Managers can insert budget for their assigned yacht
CREATE POLICY "Managers can insert own yacht budget"
  ON yacht_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budgets.yacht_id
    )
  );

-- Policy: Staff can insert budgets for any yacht
CREATE POLICY "Staff can insert all budgets"
  ON yacht_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- Policy: Managers can update budget for their assigned yacht
CREATE POLICY "Managers can update own yacht budget"
  ON yacht_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budgets.yacht_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_budgets.yacht_id
    )
  );

-- Policy: Staff can update all budgets
CREATE POLICY "Staff can update all budgets"
  ON yacht_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- Policy: Staff can delete budgets
CREATE POLICY "Staff can delete budgets"
  ON yacht_budgets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );
