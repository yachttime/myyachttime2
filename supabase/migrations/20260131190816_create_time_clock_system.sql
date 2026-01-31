/*
  # Create Time Clock System

  ## Overview
  Creates a comprehensive time clock system for tracking staff work hours with payroll reporting.
  Supports both hourly and salary employees with automatic lunch deductions for salary staff.
  Includes overtime tracking (over 8 hours per day) and payroll period management.

  ## New Tables
  
  ### `staff_time_entries`
  Stores all punch in/out records for staff, mechanics, and masters.
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to user_profiles.user_id)
  - `yacht_id` (uuid, nullable, foreign key to yachts)
  - `punch_in_time` (timestamptz)
  - `punch_out_time` (timestamptz, nullable)
  - `lunch_break_start` (timestamptz, nullable) - for hourly employees
  - `lunch_break_end` (timestamptz, nullable) - for hourly employees
  - `total_hours` (numeric, calculated)
  - `standard_hours` (numeric, up to 8 hours per day)
  - `overtime_hours` (numeric, anything over 8 hours per day)
  - `notes` (text, nullable)
  - `is_edited` (boolean, default false)
  - `edited_by` (uuid, nullable, foreign key to user_profiles.user_id)
  - `edited_at` (timestamptz, nullable)
  - `edit_reason` (text, nullable)
  - `punch_in_ip` (text, nullable)
  - `punch_out_ip` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `payroll_periods`
  Tracks pay periods and their status.
  - `id` (uuid, primary key)
  - `period_name` (text) - e.g., "January 1-15, 2024"
  - `period_start` (date) - start of period
  - `period_end` (date) - end of period
  - `cutoff_date` (date) - 5 days before payment date
  - `payment_date` (date) - scheduled payment date
  - `actual_payment_date` (date) - adjusted for weekends
  - `status` (text) - 'open', 'locked', 'closed', 'paid'
  - `total_standard_hours` (numeric, nullable)
  - `total_overtime_hours` (numeric, nullable)
  - `closed_by` (uuid, nullable, foreign key to user_profiles.user_id)
  - `closed_at` (timestamptz, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `time_entry_audit_log`
  Tracks all edits to time entries for compliance.
  - `id` (uuid, primary key)
  - `time_entry_id` (uuid, foreign key to staff_time_entries)
  - `edited_by` (uuid, foreign key to user_profiles.user_id)
  - `field_name` (text)
  - `old_value` (text)
  - `new_value` (text)
  - `edit_reason` (text)
  - `edited_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Staff/mechanic can view and create their own time entries
  - Master role can view and edit all time entries
  - Only master role can manage payroll periods
  - Audit logs are read-only except for system inserts
*/

-- Add employee_type to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'employee_type'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN employee_type text DEFAULT 'hourly' CHECK (employee_type IN ('hourly', 'salary'));
  END IF;
END $$;

-- Create staff_time_entries table
CREATE TABLE IF NOT EXISTS staff_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  yacht_id uuid REFERENCES yachts(id) ON DELETE SET NULL,
  punch_in_time timestamptz NOT NULL,
  punch_out_time timestamptz,
  lunch_break_start timestamptz,
  lunch_break_end timestamptz,
  total_hours numeric(5,2) DEFAULT 0,
  standard_hours numeric(5,2) DEFAULT 0,
  overtime_hours numeric(5,2) DEFAULT 0,
  notes text,
  is_edited boolean DEFAULT false,
  edited_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  edited_at timestamptz,
  edit_reason text,
  punch_in_ip text,
  punch_out_ip text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_punch_times CHECK (punch_out_time IS NULL OR punch_out_time > punch_in_time),
  CONSTRAINT valid_lunch_times CHECK (
    (lunch_break_start IS NULL AND lunch_break_end IS NULL) OR
    (lunch_break_start IS NOT NULL AND lunch_break_end IS NOT NULL AND lunch_break_end > lunch_break_start)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_time_entries_user_id ON staff_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_entries_punch_in_time ON staff_time_entries(punch_in_time);
CREATE INDEX IF NOT EXISTS idx_staff_time_entries_yacht_id ON staff_time_entries(yacht_id);

-- Create payroll_periods table
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  cutoff_date date NOT NULL,
  payment_date date NOT NULL,
  actual_payment_date date NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'locked', 'closed', 'paid')),
  total_standard_hours numeric(10,2),
  total_overtime_hours numeric(10,2),
  closed_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  closed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_period_dates UNIQUE(period_start, period_end)
);

-- Create index for payroll periods
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);

-- Create time_entry_audit_log table
CREATE TABLE IF NOT EXISTS time_entry_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES staff_time_entries(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  edit_reason text,
  edited_at timestamptz DEFAULT now()
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_time_entry_audit_log_entry_id ON time_entry_audit_log(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_audit_log_edited_at ON time_entry_audit_log(edited_at);

-- Enable RLS
ALTER TABLE staff_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entry_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_time_entries

-- Staff/mechanic can view their own entries
CREATE POLICY "Staff can view own time entries"
  ON staff_time_entries FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
  );

-- Master can view all entries
CREATE POLICY "Master can view all time entries"
  ON staff_time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Staff/mechanic/master can insert their own entries
CREATE POLICY "Staff can create own time entries"
  ON staff_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Staff can update their own incomplete entries (no punch out yet)
CREATE POLICY "Staff can update own incomplete entries"
  ON staff_time_entries FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND punch_out_time IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- Master can update any entry
CREATE POLICY "Master can update all time entries"
  ON staff_time_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Master can delete time entries
CREATE POLICY "Master can delete time entries"
  ON staff_time_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- RLS Policies for payroll_periods

-- Staff can view payroll periods
CREATE POLICY "Staff can view payroll periods"
  ON payroll_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Only master can manage payroll periods
CREATE POLICY "Master can manage payroll periods"
  ON payroll_periods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- RLS Policies for time_entry_audit_log

-- Master can view audit logs
CREATE POLICY "Master can view audit logs"
  ON time_entry_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- System can insert audit logs (through triggers)
CREATE POLICY "System can insert audit logs"
  ON time_entry_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to calculate hours worked
CREATE OR REPLACE FUNCTION calculate_time_entry_hours()
RETURNS trigger AS $$
DECLARE
  work_minutes numeric;
  lunch_minutes numeric;
  total_minutes numeric;
  user_employee_type text;
BEGIN
  -- Get employee type
  SELECT employee_type INTO user_employee_type
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  -- Only calculate if punch_out_time is set
  IF NEW.punch_out_time IS NOT NULL THEN
    -- Calculate work minutes
    work_minutes := EXTRACT(EPOCH FROM (NEW.punch_out_time - NEW.punch_in_time)) / 60;
    
    -- Calculate lunch break minutes for hourly employees
    lunch_minutes := 0;
    IF user_employee_type = 'hourly' AND NEW.lunch_break_start IS NOT NULL AND NEW.lunch_break_end IS NOT NULL THEN
      lunch_minutes := EXTRACT(EPOCH FROM (NEW.lunch_break_end - NEW.lunch_break_start)) / 60;
    END IF;
    
    -- For salary employees, deduct 1 hour (60 minutes) automatically
    IF user_employee_type = 'salary' THEN
      lunch_minutes := 60;
    END IF;
    
    -- Calculate total hours (work minutes - lunch minutes)
    total_minutes := work_minutes - lunch_minutes;
    NEW.total_hours := ROUND((total_minutes / 60)::numeric, 2);
    
    -- Calculate standard hours (up to 8) and overtime (anything over 8)
    IF NEW.total_hours <= 8 THEN
      NEW.standard_hours := NEW.total_hours;
      NEW.overtime_hours := 0;
    ELSE
      NEW.standard_hours := 8;
      NEW.overtime_hours := NEW.total_hours - 8;
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for calculating hours
DROP TRIGGER IF EXISTS calculate_hours_trigger ON staff_time_entries;
CREATE TRIGGER calculate_hours_trigger
  BEFORE INSERT OR UPDATE ON staff_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_hours();

-- Function to log time entry edits
CREATE OR REPLACE FUNCTION log_time_entry_edit()
RETURNS trigger AS $$
BEGIN
  -- Only log if this is an update and is_edited flag is being set
  IF TG_OP = 'UPDATE' AND NEW.is_edited = true AND OLD.is_edited = false THEN
    -- Log punch_in_time changes
    IF OLD.punch_in_time IS DISTINCT FROM NEW.punch_in_time THEN
      INSERT INTO time_entry_audit_log (time_entry_id, edited_by, field_name, old_value, new_value, edit_reason)
      VALUES (NEW.id, NEW.edited_by, 'punch_in_time', OLD.punch_in_time::text, NEW.punch_in_time::text, NEW.edit_reason);
    END IF;
    
    -- Log punch_out_time changes
    IF OLD.punch_out_time IS DISTINCT FROM NEW.punch_out_time THEN
      INSERT INTO time_entry_audit_log (time_entry_id, edited_by, field_name, old_value, new_value, edit_reason)
      VALUES (NEW.id, NEW.edited_by, 'punch_out_time', OLD.punch_out_time::text, NEW.punch_out_time::text, NEW.edit_reason);
    END IF;
    
    -- Log lunch_break_start changes
    IF OLD.lunch_break_start IS DISTINCT FROM NEW.lunch_break_start THEN
      INSERT INTO time_entry_audit_log (time_entry_id, edited_by, field_name, old_value, new_value, edit_reason)
      VALUES (NEW.id, NEW.edited_by, 'lunch_break_start', OLD.lunch_break_start::text, NEW.lunch_break_start::text, NEW.edit_reason);
    END IF;
    
    -- Log lunch_break_end changes
    IF OLD.lunch_break_end IS DISTINCT FROM NEW.lunch_break_end THEN
      INSERT INTO time_entry_audit_log (time_entry_id, edited_by, field_name, old_value, new_value, edit_reason)
      VALUES (NEW.id, NEW.edited_by, 'lunch_break_end', OLD.lunch_break_end::text, NEW.lunch_break_end::text, NEW.edit_reason);
    END IF;
    
    -- Log notes changes
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO time_entry_audit_log (time_entry_id, edited_by, field_name, old_value, new_value, edit_reason)
      VALUES (NEW.id, NEW.edited_by, 'notes', OLD.notes, NEW.notes, NEW.edit_reason);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging edits
DROP TRIGGER IF EXISTS log_edit_trigger ON staff_time_entries;
CREATE TRIGGER log_edit_trigger
  AFTER UPDATE ON staff_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_time_entry_edit();

-- Enable realtime for staff_time_entries
ALTER PUBLICATION supabase_realtime ADD TABLE staff_time_entries;