/*
  # Enable Realtime for Staff Messages

  1. Purpose
    - Enable realtime subscriptions for the staff_messages table
    - Allows the Dashboard to receive instant updates when new bulk emails are sent
    - Follows the same pattern as admin_notifications and yacht_history_logs

  2. Changes
    - Enable realtime replication for staff_messages table
*/

-- Enable realtime for staff_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE staff_messages;

-- Add helpful comment
COMMENT ON TABLE staff_messages IS 'Staff messages and bulk email tracking with realtime updates enabled';
