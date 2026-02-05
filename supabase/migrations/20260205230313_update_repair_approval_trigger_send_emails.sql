/*
  # Update Repair Approval Trigger to Send Email Notifications

  1. Overview
    - Calls the send-repair-approval-notification edge function when a repair is approved
    - Sends emails to all staff and master users
    - Notifies the team that work can proceed

  2. Changes
    - Update trigger function to invoke edge function via http request
    - Send approval details to the notification service
    - Handle errors gracefully without blocking the approval

  3. Security
    - Function runs with SECURITY DEFINER
    - Uses service role to invoke edge function
*/

-- Update the function to send emails when repair is approved
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
  v_owner_chat_message text;
  v_approver_name text;
  v_supabase_url text;
  v_service_role_key text;
  v_response_status int;
BEGIN
  -- Get yacht name
  SELECT name INTO v_yacht_name
  FROM yachts
  WHERE id = NEW.yacht_id;

  -- Get submitter information
  SELECT
    COALESCE(up.first_name || ' ' || up.last_name, u.email, 'Unknown User'),
    u.email
  INTO v_submitter_name, v_submitter_email
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.user_id = u.id
  WHERE u.id = NEW.submitted_by;

  -- Handle INSERT (new repair request)
  IF TG_OP = 'INSERT' THEN
    -- Create notification message for staff
    v_notification_message := format(
      'New repair request: "%s" for %s. Submitted by: %s',
      NEW.title,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Create owner chat message with more details
    v_owner_chat_message := format(
      'Repair Request Submitted: %s' || E'\n\n' || '%s' || E'\n\n' || 'Submitted by: %s',
      NEW.title,
      COALESCE(NEW.description, 'No description provided'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Insert into admin_notifications table
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id
    ) VALUES (
      'repair_request',
      NEW.id,
      v_notification_message,
      NEW.yacht_id,
      NEW.submitted_by
    );

    -- Insert into staff_messages table
    INSERT INTO staff_messages (
      created_by,
      notification_type,
      reference_id,
      message
    ) VALUES (
      NEW.submitted_by,
      'repair_request',
      NEW.id,
      v_notification_message
    );

    -- Insert into owner_chat_messages table so yacht owners can see the repair request
    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message
    ) VALUES (
      NEW.yacht_id,
      NEW.submitted_by,
      v_owner_chat_message
    );

  -- Handle UPDATE (status change to approved)
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get approver name if available
    IF NEW.approved_by IS NOT NULL THEN
      SELECT COALESCE(up.first_name || ' ' || up.last_name, u.email, 'System')
      INTO v_approver_name
      FROM auth.users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = NEW.approved_by;
    ELSE
      v_approver_name := 'System';
    END IF;

    -- Create approval notification message
    v_notification_message := format(
      'Repair request APPROVED: "%s" for %s. Approved by: %s',
      NEW.title,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      v_approver_name
    );

    -- Insert into admin_notifications for all staff to see
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id
    ) VALUES (
      'repair_approved',
      NEW.id,
      v_notification_message,
      NEW.yacht_id,
      NEW.submitted_by
    );

    -- Insert into staff_messages table to notify all staff/masters
    INSERT INTO staff_messages (
      created_by,
      notification_type,
      reference_id,
      message
    ) VALUES (
      COALESCE(NEW.approved_by, NEW.submitted_by),
      'repair_approved',
      NEW.id,
      v_notification_message
    );

    -- Also add to owner chat so the yacht owner knows it was approved
    v_owner_chat_message := format(
      'Repair Request APPROVED: %s' || E'\n\n' || 'Estimated Cost: %s' || E'\n\n' || 'Approved by: %s',
      NEW.title,
      COALESCE('$' || NEW.estimated_repair_cost, 'TBD'),
      v_approver_name
    );

    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message
    ) VALUES (
      NEW.yacht_id,
      COALESCE(NEW.approved_by, NEW.submitted_by),
      v_owner_chat_message
    );

    -- Send email notifications to all staff and master users
    BEGIN
      SELECT current_setting('request.headers')::json->>'x-supabase-url' INTO v_supabase_url;
      SELECT current_setting('request.headers')::json->>'x-supabase-service-role-key' INTO v_service_role_key;
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_role_key := current_setting('app.settings.service_role_key', true);
    END;

    -- Use environment variables if headers not available
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    END IF;

    -- Call edge function to send email notifications
    IF v_supabase_url IS NOT NULL THEN
      BEGIN
        SELECT status INTO v_response_status
        FROM http((
          'POST',
          v_supabase_url || '/functions/v1/send-repair-approval-notification',
          ARRAY[http_header('Content-Type', 'application/json')],
          'application/json',
          json_build_object(
            'repairRequestId', NEW.id,
            'repairTitle', NEW.title,
            'yachtName', COALESCE(v_yacht_name, 'Unknown Yacht'),
            'approverName', v_approver_name,
            'estimatedCost', NEW.estimated_repair_cost
          )::text
        )::http_request);

        IF v_response_status != 200 THEN
          RAISE WARNING 'Failed to send approval notification emails: HTTP %', v_response_status;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error calling send-repair-approval-notification: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger is already created, no need to recreate
