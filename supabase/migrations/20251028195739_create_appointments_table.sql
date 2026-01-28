/*
  # Create Appointments Table

  1. New Tables
    - `appointments`
      - `id` (uuid, primary key)
      - `date` (date) - The appointment date
      - `time` (time) - The appointment time
      - `name` (text) - Customer name
      - `phone` (text) - Customer phone
      - `email` (text) - Customer email
      - `yacht_id` (uuid, foreign key) - Reference to yacht
      - `problem_description` (text) - Description of repair needed
      - `created_by` (uuid, foreign key) - User who created the appointment
      - `created_at` (timestamptz) - When appointment was created
      - `updated_at` (timestamptz) - When appointment was last updated

  2. Security
    - Enable RLS on `appointments` table
    - Add policy for staff to create appointments
    - Add policy for staff and managers to view appointments
    - Add policy for users to view/edit their own yacht appointments

  3. Indexes
    - Index on `date` for calendar queries
    - Index on `yacht_id` for yacht-specific queries
*/

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  time time NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  problem_description text NOT NULL,
  created_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_yacht_id ON appointments(yacht_id);

CREATE POLICY "Staff can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff and managers can view all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Users can view appointments for their yacht"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = appointments.yacht_id
    )
  );

CREATE POLICY "Staff can update appointments"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Staff can delete appointments"
  ON appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );