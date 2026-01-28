/*
  # Create Repair Requests Table

  1. New Tables
    - `repair_requests`
      - `id` (uuid, primary key)
      - `yacht_id` (uuid, foreign key to yachts)
      - `submitted_by` (uuid, foreign key to auth.users)
      - `title` (text, required) - Short description of repair
      - `description` (text) - Detailed description
      - `file_url` (text) - URL to uploaded file
      - `file_name` (text) - Original file name
      - `status` (text) - pending, approved, rejected, completed
      - `approved_by` (uuid, foreign key to auth.users)
      - `approval_notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `repair_requests` table
    - Add policy for authenticated users to create repair requests
    - Add policy for managers to view and approve requests
    - Add policy for staff to view their own requests
*/

CREATE TABLE IF NOT EXISTS repair_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text,
  file_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  approved_by uuid REFERENCES auth.users(id),
  approval_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE repair_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create repair requests"
  ON repair_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can view own repair requests"
  ON repair_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);

CREATE POLICY "Managers can view all repair requests for their yacht"
  ON repair_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = repair_requests.yacht_id
    )
  );

CREATE POLICY "Managers can update repair requests for their yacht"
  ON repair_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = repair_requests.yacht_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = repair_requests.yacht_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_repair_requests_yacht_id ON repair_requests(yacht_id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_status ON repair_requests(status);