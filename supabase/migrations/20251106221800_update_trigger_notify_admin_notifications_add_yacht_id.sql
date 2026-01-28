/*
  # Update Admin Notification Trigger to Include Yacht ID

  1. Changes
    - Updated `notify_staff_of_admin_notification()` function to pass yacht_id to edge function
    - This allows managers to be filtered by their assigned yacht
    
  2. Notes
    - Staff and mechanics see all notifications
    - Managers only see notifications for their assigned yacht
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
        'yachtId', NEW.yacht_id,
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