/*
  # Create Staff Schedule Overrides Table

  1. New Tables
    - `staff_schedule_overrides`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `override_date` (date) - the specific date being overridden
      - `status` (text) - working, approved_day_off, sick_leave
      - `notes` (text, nullable)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (user_id, override_date)

  2. Security
    - Enable RLS
    - Master and staff roles can view all overrides
    - Only master and staff can create/update/delete overrides
    - Regular users can view their own overrides

  3. Purpose
    - Allows master/staff to override regular work schedules for specific dates
    - Track sick days, approved days off, and special working days
    - Overrides take precedence over regular weekly schedules
*/

-- Create staff_schedule_overrides table
CREATE TABLE IF NOT EXISTS staff_schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('working', 'approved_day_off', 'sick_leave')),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, override_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_schedule_overrides_user_id ON staff_schedule_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_overrides_date ON staff_schedule_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_overrides_status ON staff_schedule_overrides(status);

-- Enable Row Level Security
ALTER TABLE staff_schedule_overrides ENABLE ROW LEVEL SECURITY;

-- Master and staff can view all overrides
CREATE POLICY "Master and staff can view all schedule overrides"
  ON staff_schedule_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff')
    )
  );

-- Users can view their own overrides
CREATE POLICY "Users can view own schedule overrides"
  ON staff_schedule_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only master and staff can insert overrides
CREATE POLICY "Master and staff can create schedule overrides"
  ON staff_schedule_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff')
    )
  );

-- Only master and staff can update overrides
CREATE POLICY "Master and staff can update schedule overrides"
  ON staff_schedule_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff')
    )
  );

-- Only master and staff can delete overrides
CREATE POLICY "Master and staff can delete schedule overrides"
  ON staff_schedule_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff')
    )
  );

-- Enable realtime for staff_schedule_overrides
ALTER PUBLICATION supabase_realtime ADD TABLE staff_schedule_overrides;