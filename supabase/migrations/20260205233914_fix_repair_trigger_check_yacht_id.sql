/*
  # Fix Repair Request Trigger to Check yacht_id Before Owner Chat Insert

  1. Overview
    - Updates the repair request trigger to only insert into owner_chat_messages when yacht_id is NOT NULL
    - Prevents constraint violations for retail customers who don't have a yacht

  2. Changes
    - Add yacht_id NULL checks before inserting into owner_chat_messages
    - Retail customers (no yacht_id) won't get owner chat messages (which is correct)
    - All other functionality remains the same

  3. Security
    - No security changes
    - Function continues to run with SECURITY DEFINER
*/

-- Update the function to check yacht_id before inserting into owner_chat_messages
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
BEGIN
  -- Get yacht name if yacht_id exists
  IF NEW.yacht_id IS NOT NULL THEN
    SELECT name INTO v_yacht_name
    FROM yachts
    WHERE id = NEW.yacht_id;
  END IF;

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
      COALESCE(v_yacht_name, 'Retail Customer'),
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

    -- Insert into owner_chat_messages table ONLY if yacht_id exists
    -- Retail customers don't have yachts, so no owner chat messages for them
    IF NEW.yacht_id IS NOT NULL THEN
      INSERT INTO owner_chat_messages (
        yacht_id,
        user_id,
        message
      ) VALUES (
        NEW.yacht_id,
        NEW.submitted_by,
        v_owner_chat_message
      );
    END IF;

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
      COALESCE(v_yacht_name, 'Retail Customer'),
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

    -- Also add to owner chat ONLY if yacht_id exists
    -- Retail customers don't have yachts, so no owner chat messages for them
    IF NEW.yacht_id IS NOT NULL THEN
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
    END IF;

    -- Send email notifications to all staff and master users via edge function
    BEGIN
      -- Get Supabase URL from environment
      SELECT COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://eqiecntollhgfxmmbize.supabase.co'
      ) INTO v_supabase_url;

      -- Call edge function using pg_net
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-repair-approval-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'repairRequestId', NEW.id,
          'repairTitle', NEW.title,
          'yachtName', COALESCE(v_yacht_name, 'Retail Customer'),
          'approverName', v_approver_name,
          'estimatedCost', NEW.estimated_repair_cost
        )
      );

      RAISE LOG 'Queued repair approval notification email for repair request %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error calling send-repair-approval-notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;