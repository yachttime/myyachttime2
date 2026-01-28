/*
  # Create Triggers for New User Notifications and Activity Logs

  1. New Functions
    - `notify_admin_new_user()` - Creates an admin notification when a new user is created
    - `log_new_user_activity()` - Creates a yacht history log entry when a new user is created

  2. New Triggers
    - Trigger on user_profiles INSERT to create admin notification
    - Trigger on user_profiles INSERT to create yacht activity log

  3. Security
    - Functions run with SECURITY DEFINER to bypass RLS
    - Only triggers on INSERT operations
*/

-- Function to create admin notification for new user
CREATE OR REPLACE FUNCTION notify_admin_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  yacht_name_var TEXT;
  user_name TEXT;
BEGIN
  -- Get yacht name if yacht_id exists
  IF NEW.yacht_id IS NOT NULL THEN
    SELECT name INTO yacht_name_var FROM yachts WHERE id = NEW.yacht_id;
  END IF;

  -- Build user name
  user_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email);

  -- Create admin notification
  INSERT INTO admin_notifications (
    yacht_id,
    user_id,
    message,
    notification_type,
    reference_id
  ) VALUES (
    NEW.yacht_id,
    NEW.user_id,
    'New user registered: ' || user_name || 
    CASE 
      WHEN NEW.role IS NOT NULL THEN ' (Role: ' || NEW.role || ')'
      ELSE ''
    END ||
    CASE 
      WHEN yacht_name_var IS NOT NULL THEN ' for yacht ' || yacht_name_var
      ELSE ''
    END,
    'new_user',
    NEW.user_id
  );

  RETURN NEW;
END;
$$;

-- Function to log new user in yacht activity
CREATE OR REPLACE FUNCTION log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  yacht_name_var TEXT;
  user_name TEXT;
BEGIN
  -- Only log if user is associated with a yacht
  IF NEW.yacht_id IS NOT NULL THEN
    -- Get yacht name
    SELECT name INTO yacht_name_var FROM yachts WHERE id = NEW.yacht_id;
    
    -- Build user name
    user_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email);

    -- Create yacht history log
    INSERT INTO yacht_history_logs (
      yacht_id,
      yacht_name,
      action,
      created_by,
      created_by_name,
      reference_id,
      reference_type
    ) VALUES (
      NEW.yacht_id,
      yacht_name_var,
      'New user registered: ' || user_name || 
      CASE 
        WHEN NEW.role IS NOT NULL THEN ' (Role: ' || NEW.role || ')'
        ELSE ''
      END,
      NEW.user_id,
      user_name,
      NEW.user_id,
      'user_profile'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_notify_admin_new_user ON user_profiles;
DROP TRIGGER IF EXISTS trigger_log_new_user_activity ON user_profiles;

-- Create trigger for admin notification
CREATE TRIGGER trigger_notify_admin_new_user
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_user();

-- Create trigger for yacht activity log
CREATE TRIGGER trigger_log_new_user_activity
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_new_user_activity();