/*
  # Create Database Trigger for Admin Notifications

  1. New Functions
    - `notify_staff_of_admin_notification()` - Trigger function that calls edge function when new admin notification is created
    
  2. New Triggers
    - `trigger_notify_admin_notification` - Fires after insert on admin_notifications table
    
  3. Security
    - Function runs with SECURITY DEFINER to allow calling edge function
    - Only triggers on INSERT operations (not UPDATE or DELETE)
    
  4. Notes
    - Calls the send-message-notification edge function
    - Passes yacht name, sender name, and message content
    - Handles errors gracefully without blocking the insert operation
*/

CREATE OR REPLACE FUNCTION notify_staff_of_admin_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_yacht_name text;
  v_sender_name text;
  v_supabase_url text;
  v_supabase_anon_key text;
BEGIN
  BEGIN
    SELECT name INTO v_yacht_name
    FROM yachts
    WHERE id = NEW.yacht_id;

    SELECT COALESCE(first_name || ' ' || last_name, 'Unknown User')
    INTO v_sender_name
    FROM user_profiles
    WHERE user_id = NEW.user_id;

    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-message-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := jsonb_build_object(
        'messageType', 'yacht_message',
        'messageId', NEW.id,
        'yachtName', v_yacht_name,
        'senderName', v_sender_name,
        'messageContent', NEW.message,
        'notificationType', NEW.notification_type
      )
    );

    RAISE NOTICE 'Notification sent for admin notification %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send notification for admin notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admin_notification ON admin_notifications;

CREATE TRIGGER trigger_notify_admin_notification
  AFTER INSERT ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_staff_of_admin_notification();