/*
  # Add Email Notifications for Support Tickets

  1. Updates
    - Update the notify_new_support_ticket trigger to send email via edge function
    - Calls the send-support-ticket-notification edge function to notify staff

  2. Notes
    - Uses pg_net extension to make HTTP requests
    - Sends notification emails to master and manager roles
*/

-- Update notification trigger to send email via edge function
CREATE OR REPLACE FUNCTION notify_new_support_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_name text;
  v_user_email text;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Get user information
  SELECT full_name, email_address
  INTO v_user_name, v_user_email
  FROM user_profiles
  WHERE user_id = NEW.user_id;
  
  -- Create admin notification for staff
  INSERT INTO admin_notifications (
    type,
    title,
    message,
    reference_id,
    company_id,
    created_at
  ) VALUES (
    'support_ticket',
    'New Support Ticket: ' || NEW.ticket_number,
    v_user_name || ' submitted a support ticket: ' || NEW.subject,
    NEW.id,
    NEW.company_id,
    now()
  );

  -- Get Supabase configuration
  SELECT decrypted_secret 
  INTO v_supabase_url
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret 
  INTO v_service_role_key
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  -- If secrets not found in vault, use environment variables
  IF v_supabase_url IS NULL THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF v_service_role_key IS NULL THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Send email notification via edge function (async, non-blocking)
  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-support-ticket-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'ticketId', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;