/*
  # Create Pay Periods Table

  1. New Tables
    - `pay_periods`
      - `id` (uuid, primary key)
      - `period_start` (date) - Start date of the pay cycle
      - `period_end` (date) - End date of the pay cycle
      - `pay_date` (date) - Date employees receive payment
      - `year` (integer) - Calendar year for easy filtering
      - `period_number` (integer) - Sequential number within the year (1, 2, 3...)
      - `is_processed` (boolean) - Whether payroll has been processed for this period
      - `notes` (text) - Optional notes about this pay period
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `pay_periods` table
    - Allow staff, mechanic, and master roles to view all pay periods
    - Allow staff, mechanic, and master roles to insert/update/delete pay periods

  3. Indexes
    - Index on year for fast filtering
    - Index on period_start and period_end for date range queries
    - Unique constraint on year + period_number
*/

CREATE TABLE IF NOT EXISTS pay_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  pay_date date NOT NULL,
  year integer NOT NULL,
  period_number integer NOT NULL,
  is_processed boolean DEFAULT false NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pay_periods_year_period_unique UNIQUE (year, period_number),
  CONSTRAINT pay_periods_dates_valid CHECK (period_start <= period_end),
  CONSTRAINT pay_periods_pay_date_valid CHECK (pay_date >= period_end)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pay_periods_year ON pay_periods(year);
CREATE INDEX IF NOT EXISTS idx_pay_periods_dates ON pay_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_pay_periods_pay_date ON pay_periods(pay_date);

-- Enable RLS
ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;

-- Allow staff, mechanic, and master to view all pay periods
CREATE POLICY "Staff can view all pay periods"
  ON pay_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Allow staff, mechanic, and master to insert pay periods
CREATE POLICY "Staff can insert pay periods"
  ON pay_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Allow staff, mechanic, and master to update pay periods
CREATE POLICY "Staff can update pay periods"
  ON pay_periods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Allow staff, mechanic, and master to delete pay periods
CREATE POLICY "Staff can delete pay periods"
  ON pay_periods FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Create helper function to get pay period for a given date
CREATE OR REPLACE FUNCTION get_pay_period_for_date(check_date date)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pay_period_id uuid;
BEGIN
  SELECT id INTO v_pay_period_id
  FROM pay_periods
  WHERE check_date >= period_start
    AND check_date <= period_end
  LIMIT 1;
  
  RETURN v_pay_period_id;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_pay_period_for_date(date) TO authenticated;
