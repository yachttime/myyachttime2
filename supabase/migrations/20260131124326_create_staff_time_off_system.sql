/*
  # Create Staff Time Off Management System

  1. New Tables
    - `staff_time_off_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `start_date` (date)
      - `end_date` (date)
      - `time_off_type` (text) - vacation, sick_leave, personal_day, unpaid
      - `status` (text) - pending, approved, rejected
      - `reason` (text, nullable)
      - `submitted_at` (timestamptz)
      - `reviewed_by` (uuid, nullable, foreign key to auth.users)
      - `reviewed_at` (timestamptz, nullable)
      - `review_notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `staff_schedules`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `day_of_week` (integer) - 0=Sunday through 6=Saturday
      - `is_working_day` (boolean)
      - `start_time` (time, nullable)
      - `end_time` (time, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Staff can view/manage all records
    - Mechanics can view/manage only their own records
    - Only staff can approve/reject time-off requests
*/

-- Create staff_time_off_requests table
CREATE TABLE IF NOT EXISTS staff_time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  time_off_type text NOT NULL CHECK (time_off_type IN ('vacation', 'sick_leave', 'personal_day', 'unpaid')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create staff_schedules table
CREATE TABLE IF NOT EXISTS staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_working_day boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_time_off_requests_user_id ON staff_time_off_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_requests_status ON staff_time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_requests_dates ON staff_time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_user_id ON staff_schedules(user_id);

-- Enable Row Level Security
ALTER TABLE staff_time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_time_off_requests

-- Staff can view all time-off requests
CREATE POLICY "Staff can view all time off requests"
  ON staff_time_off_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Mechanics can view their own time-off requests
CREATE POLICY "Mechanics can view own time off requests"
  ON staff_time_off_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff and mechanics can insert their own requests
CREATE POLICY "Users can create own time off requests"
  ON staff_time_off_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

-- Only staff can update requests (for approval/rejection)
CREATE POLICY "Staff can update time off requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending requests"
  ON staff_time_off_requests
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Staff can delete any request
CREATE POLICY "Staff can delete time off requests"
  ON staff_time_off_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Users can delete their own pending requests
CREATE POLICY "Users can delete own pending requests"
  ON staff_time_off_requests
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- RLS Policies for staff_schedules

-- Staff can view all schedules
CREATE POLICY "Staff can view all schedules"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Mechanics can view their own schedule
CREATE POLICY "Users can view own schedule"
  ON staff_schedules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only staff can insert schedules
CREATE POLICY "Staff can create schedules"
  ON staff_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Only staff can update schedules
CREATE POLICY "Staff can update schedules"
  ON staff_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Only staff can delete schedules
CREATE POLICY "Staff can delete schedules"
  ON staff_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Enable realtime for staff_time_off_requests
ALTER PUBLICATION supabase_realtime ADD TABLE staff_time_off_requests;