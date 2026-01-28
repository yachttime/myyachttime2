/*
  # Create Database Trigger for Staff Messages

  1. New Functions
    - `notify_staff_of_staff_message()` - Trigger function that calls edge function when new staff message is created
    
  2. New Triggers
    - `trigger_notify_staff_message` - Fires after insert on staff_messages table
    
  3. Security
    - Function runs with SECURITY DEFINER to allow calling edge function
    - Only triggers on INSERT operations (not UPDATE or DELETE)
    
  4. Notes
    - Calls the send-message-notification edge function
    - Passes sender name and message content
    - Handles errors gracefully without blocking the insert operation
*/

CREATE OR REPLACE FUNCTION notify_staff_of_staff_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_sender_name text;
  v_supabase_url text;
  v_supabase_anon_key text;
BEGIN
  BEGIN
    SELECT COALESCE(first_name || ' ' || last_name, 'Unknown User')
    INTO v_sender_name
    FROM user_profiles
    WHERE user_id = NEW.created_by;

    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-message-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := jsonb_build_object(
        'messageType', 'staff_message',
        'messageId', NEW.id,
        'senderName', v_sender_name,
        'messageContent', NEW.message,
        'notificationType', NEW.notification_type
      )
    );

    RAISE NOTICE 'Notification sent for staff message %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send notification for staff message %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_staff_message ON staff_messages;

CREATE TRIGGER trigger_notify_staff_message
  AFTER INSERT ON staff_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_staff_of_staff_message();