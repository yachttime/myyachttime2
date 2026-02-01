/*
  # Create Time Clock Reminders System

  1. New Tables
    - `time_clock_reminders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles) - Staff member who needs reminder
      - `schedule_date` (date) - The date of the scheduled shift
      - `scheduled_start_time` (time) - When they were supposed to start
      - `reminder_sent_at` (timestamptz) - When the reminder was sent
      - `punched_in_at` (timestamptz, nullable) - When they actually punched in (if they did after reminder)
      - `created_at` (timestamptz) - When this record was created

  2. Security
    - Enable RLS on `time_clock_reminders` table
    - Add policies for staff and master roles to view their own reminders
    - Add policy for system (service role) to insert reminders

  3. Indexes
    - Index on (user_id, schedule_date) for quick lookups
    - Index on reminder_sent_at for cleanup queries
*/

-- Create the reminders tracking table
CREATE TABLE IF NOT EXISTS time_clock_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  scheduled_start_time time NOT NULL,
  reminder_sent_at timestamptz DEFAULT now(),
  punched_in_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_clock_reminders_user_date 
  ON time_clock_reminders(user_id, schedule_date);

CREATE INDEX IF NOT EXISTS idx_time_clock_reminders_sent_at 
  ON time_clock_reminders(reminder_sent_at);

-- Enable RLS
ALTER TABLE time_clock_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own reminders
CREATE POLICY "Users can view own time clock reminders"
  ON time_clock_reminders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Master role can view all reminders
CREATE POLICY "Master can view all time clock reminders"
  ON time_clock_reminders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policy: Service role can insert reminders (for edge function)
CREATE POLICY "Service role can insert reminders"
  ON time_clock_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: System can update reminders when user punches in
CREATE POLICY "System can update punch in time"
  ON time_clock_reminders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
