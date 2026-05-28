/*
  # Create Inspection Time Entries Table

  ## Purpose
  Tracks 2.0 hours automatically credited to employees whenever they complete
  a trip inspection or a "Meet the Yacht Owner" (owner handoff) inspection.
  These hours appear as "Inspection Hours" in the payroll report and are
  included in the Grand Total.

  ## New Tables
  - `inspection_time_entries`
    - `id` (uuid, primary key)
    - `user_id` (uuid) - the inspector/employee who completed the inspection
    - `yacht_id` (uuid, nullable) - the yacht the inspection was for
    - `inspection_id` (uuid) - FK to either trip_inspections or owner_handoff_inspections
    - `inspection_type` (text) - 'trip_inspection' or 'owner_handoff'
    - `hours` (numeric 5,2) - fixed at 2.0
    - `inspection_date` (timestamptz) - when the inspection was completed
    - `company_id` (uuid, nullable)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Staff/master can insert and view
  - Employees can view their own entries
*/

CREATE TABLE IF NOT EXISTS inspection_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  yacht_id uuid REFERENCES yachts(id) ON DELETE SET NULL,
  inspection_id uuid NOT NULL,
  inspection_type text NOT NULL CHECK (inspection_type IN ('trip_inspection', 'owner_handoff')),
  hours numeric(5,2) NOT NULL DEFAULT 2.00,
  inspection_date timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_time_entries_user_id ON inspection_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_inspection_time_entries_inspection_date ON inspection_time_entries(inspection_date);
CREATE INDEX IF NOT EXISTS idx_inspection_time_entries_company_id ON inspection_time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_inspection_time_entries_inspection_id ON inspection_time_entries(inspection_id);

ALTER TABLE inspection_time_entries ENABLE ROW LEVEL SECURITY;

-- Staff (all roles except owner) can insert inspection time entries
CREATE POLICY "Staff can insert inspection time entries"
  ON inspection_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

-- Employees can view their own inspection time entries
CREATE POLICY "Employees can view own inspection time entries"
  ON inspection_time_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff/master can view all inspection time entries within their company
CREATE POLICY "Staff can view all inspection time entries"
  ON inspection_time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

-- Master can delete inspection time entries
CREATE POLICY "Master can delete inspection time entries"
  ON inspection_time_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'master'
    )
  );
