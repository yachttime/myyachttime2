/*
  # Create Staff Messages Table

  1. New Tables
    - `staff_messages`
      - `id` (uuid, primary key)
      - `message` (text) - The notification message
      - `notification_type` (text) - Type of notification (e.g., 'appointment', 'general')
      - `reference_id` (uuid, nullable) - Reference to related record
      - `created_by` (uuid, foreign key) - User who created the message
      - `is_read` (boolean) - Whether the message has been read
      - `created_at` (timestamptz) - When message was created

  2. Security
    - Enable RLS on `staff_messages` table
    - Add policy for staff and managers to view all messages
    - Add policy for authenticated users to create messages
    - Add policy for staff to mark messages as read

  3. Indexes
    - Index on `created_at` for sorting
    - Index on `is_read` for filtering
*/

CREATE TABLE IF NOT EXISTS staff_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  notification_type text DEFAULT 'general',
  reference_id uuid,
  created_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_staff_messages_created_at ON staff_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_messages_is_read ON staff_messages(is_read);

CREATE POLICY "Staff and managers can view all staff messages"
  ON staff_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Authenticated users can create staff messages"
  ON staff_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Staff can update staff messages"
  ON staff_messages
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

CREATE POLICY "Staff can delete staff messages"
  ON staff_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );