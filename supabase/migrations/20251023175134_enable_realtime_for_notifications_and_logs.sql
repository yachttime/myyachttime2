/*
  # Enable Realtime for Admin Notifications and Activity Logs

  1. Changes
    - Enable realtime publication for admin_notifications table
    - Enable realtime publication for user_profiles table
    - Enable realtime publication for yacht_history_logs table
    
  2. Notes
    - This allows the frontend to subscribe to INSERT events on these tables
    - Necessary for real-time updates when new users are created
*/

-- Enable realtime for admin_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;

-- Enable realtime for user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

-- Enable realtime for yacht_history_logs
ALTER PUBLICATION supabase_realtime ADD TABLE yacht_history_logs;