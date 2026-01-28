/*
  # Create smart lock command logs table for debugging

  1. New Tables
    - `smart_lock_command_logs`
      - `id` (uuid, primary key)
      - `device_id` (uuid, foreign key to yacht_smart_devices)
      - `yacht_id` (uuid, foreign key to yachts)
      - `command_type` (text) - Type of command (setup_key, unlock, lock, status)
      - `command_payload` (jsonb) - The actual command sent
      - `response_data` (jsonb) - The response received
      - `success` (boolean) - Whether the command succeeded
      - `error_message` (text, nullable) - Any error message
      - `attempt_number` (integer) - Which attempt in a sequence
      - `method_name` (text, nullable) - Name of the encryption method tried
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `smart_lock_command_logs` table
    - Add policies for staff to view all logs
    - Add policies for owners to view logs for their yacht

  3. Indexes
    - Index on device_id for fast lookups
    - Index on created_at for time-based queries
    - Index on success for filtering
*/

CREATE TABLE IF NOT EXISTS smart_lock_command_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES yacht_smart_devices(id) ON DELETE CASCADE,
  yacht_id uuid REFERENCES yachts(id) ON DELETE CASCADE,
  command_type text NOT NULL,
  command_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  attempt_number integer NOT NULL DEFAULT 1,
  method_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE smart_lock_command_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_command_logs_device_id ON smart_lock_command_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_created_at ON smart_lock_command_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_logs_success ON smart_lock_command_logs(success);

CREATE POLICY "Staff can view all command logs"
  ON smart_lock_command_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('manager', 'staff', 'mechanic')
    )
  );

CREATE POLICY "Owners can view logs for their yacht"
  ON smart_lock_command_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = smart_lock_command_logs.yacht_id
    )
  );

CREATE POLICY "System can insert command logs"
  ON smart_lock_command_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);