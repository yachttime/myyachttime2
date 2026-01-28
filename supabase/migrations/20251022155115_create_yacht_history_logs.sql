/*
  # Create Yacht History Logs Table

  1. New Tables
    - `yacht_history_logs`
      - `id` (uuid, primary key)
      - `yacht_id` (uuid, foreign key to yachts)
      - `yacht_name` (text) - denormalized for easy display
      - `action` (text) - description of the action
      - `created_at` (timestamp)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_by_name` (text) - denormalized for easy display

  2. Security
    - Enable RLS on `yacht_history_logs` table
    - Add policy for authenticated users to read all logs
    - Add policy for authenticated users to insert logs
*/

CREATE TABLE IF NOT EXISTS yacht_history_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid REFERENCES yachts(id) ON DELETE CASCADE NOT NULL,
  yacht_name text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text
);

ALTER TABLE yacht_history_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all yacht history logs"
  ON yacht_history_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert yacht history logs"
  ON yacht_history_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_yacht_id ON yacht_history_logs(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_created_at ON yacht_history_logs(created_at DESC);
