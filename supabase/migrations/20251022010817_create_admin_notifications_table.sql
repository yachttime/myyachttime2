/*
  # Create Admin Notifications Table

  1. New Tables
    - `admin_notifications`
      - `id` (uuid, primary key)
      - `yacht_id` (uuid, foreign key to yachts)
      - `user_id` (uuid, foreign key to auth.users)
      - `message` (text, required) - The notification message
      - `notification_type` (text) - Type of notification (check_in, check_out, repair_request, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `admin_notifications` table
    - Add policy for authenticated users to create notifications
    - Add policy for all authenticated users to view notifications (for admin panel)

  3. Notes
    - This table is separate from owner_chat_messages
    - Used for system notifications like check-in/check-out alerts
    - Viewable by all authenticated users in the admin panel
    - owner_chat_messages is only for owner-to-owner communication
*/

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  notification_type text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create notifications
CREATE POLICY "Authenticated users can create notifications"
  ON admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to view notifications (for admin panel)
CREATE POLICY "Authenticated users can view notifications"
  ON admin_notifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_yacht_id ON admin_notifications(yacht_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type);
