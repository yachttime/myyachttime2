/*
  # Remove repair-related messages from owner chat

  ## Summary
  Repair request notifications (submitted, approved, denied, completed, invoice sent)
  and payment confirmation messages were being inserted into owner_chat_messages,
  cluttering the owner chat with system messages that don't belong there.
  This migration:
  1. Deletes all existing repair-related and payment-related messages from owner_chat_messages
  2. Updates the create_notifications_for_repair_request() trigger function to stop
     inserting repair notifications into owner_chat_messages (while keeping admin_notifications
     and staff_messages inserts intact)

  ## Messages removed
  - "Repair Request Submitted: ..."
  - "Repair Request APPROVED: ..."
  - "Repair Request Approved: ..."
  - "Repair Request REJECTED: ..."
  - "Repair Request Denied: ..."
  - "Repair Request Completed & Invoice Sent: ..."
  - "Repair Completed: ..."
  - "Invoice Added to Repair: ..."
  - "Deposit payment confirmed for ..."
  - "Payment confirmed for ..."
  - "Payment link email sent to ..."

  ## Trigger changes
  - create_notifications_for_repair_request(): removed all 3 INSERT INTO owner_chat_messages
    blocks (for submitted, approved, and rejected repair requests). Admin notifications
    and staff messages are still created as before.
*/

-- Delete all repair-related and payment-related messages from owner chat
DELETE FROM owner_chat_messages
WHERE message LIKE 'Repair Request%'
   OR message LIKE 'Repair Completed%'
   OR message LIKE 'Invoice Added to Repair%'
   OR message LIKE 'Deposit payment confirmed%'
   OR message LIKE 'Payment confirmed for%'
   OR message LIKE 'Payment link email sent%';

-- Update the trigger function to stop inserting repair messages into owner chat
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yacht_name text;
  v_customer_name text;
  v_display_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
  v_actor_name text;
  v_actor_id text;
  v_supabase_url text;
BEGIN
  IF NEW.yacht_id IS NOT NULL THEN
    SELECT name INTO v_yacht_name
    FROM yachts
    WHERE id = NEW.yacht_id;
  END IF;

  v_customer_name := NEW.customer_name;

  IF v_yacht_name IS NOT NULL AND v_customer_name IS NOT NULL THEN
    v_display_name := v_yacht_name || ' (' || v_customer_name || ')';
  ELSIF v_yacht_name IS NOT NULL THEN
    v_display_name := v_yacht_name;
  ELSIF v_customer_name IS NOT NULL THEN
    v_display_name := v_customer_name;
  ELSE
    v_display_name := 'Retail Customer';
  END IF;

  SELECT
    COALESCE(up.first_name || ' ' || up.last_name, u.email, 'Unknown User'),
    u.email
  INTO v_submitter_name, v_submitter_email
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.user_id = u.id
  WHERE u.id = NEW.submitted_by;

  IF TG_OP = 'INSERT' THEN
    v_notification_message := format(
      'New repair request: "%s" for %s. Submitted by: %s',
      NEW.title,
      v_display_name,
      COALESCE(v_submitter_name, 'Unknown User')
    );

    INSERT INTO admin_notifications (
      notification_type, reference_id, message, yacht_id, user_id
    ) VALUES (
      'repair_request', NEW.id, v_notification_message, NEW.yacht_id, NEW.submitted_by
    );

    INSERT INTO staff_messages (
      created_by, notification_type, reference_id, message
    ) VALUES (
      NEW.submitted_by, 'repair_request', NEW.id, v_notification_message
    );

    -- Notify all staff/master via email + SMS when an owner submits a request
    IF NEW.is_retail_customer = false OR NEW.is_retail_customer IS NULL THEN
      BEGIN
        SELECT COALESCE(
          current_setting('app.settings.supabase_url', true),
          'https://eqiecntollhgfxmmbize.supabase.co'
        ) INTO v_supabase_url;

        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-owner-repair-notification',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'repairRequestId', NEW.id,
            'repairTitle', NEW.title,
            'repairDescription', NEW.description,
            'yachtName', COALESCE(v_yacht_name, 'Unknown Vessel'),
            'submitterName', COALESCE(v_submitter_name, 'Unknown User')
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error calling send-owner-repair-notification: %', SQLERRM;
      END;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_actor_id := NEW.approved_by;

    IF v_actor_id IS NOT NULL THEN
      SELECT COALESCE(up.first_name || ' ' || up.last_name, u.email, 'System')
      INTO v_actor_name
      FROM auth.users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = v_actor_id;
    ELSE
      v_actor_name := 'System';
    END IF;

    v_notification_message := format(
      'Repair request APPROVED: "%s" for %s. Approved by: %s',
      NEW.title,
      v_display_name,
      v_actor_name
    );

    INSERT INTO admin_notifications (
      notification_type, reference_id, message, yacht_id, user_id
    ) VALUES (
      'repair_approved', NEW.id, v_notification_message, NEW.yacht_id, NEW.submitted_by
    );

    INSERT INTO staff_messages (
      created_by, notification_type, reference_id, message
    ) VALUES (
      COALESCE(v_actor_id, NEW.submitted_by), 'repair_approved', NEW.id, v_notification_message
    );

    BEGIN
      SELECT COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://eqiecntollhgfxmmbize.supabase.co'
      ) INTO v_supabase_url;

      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-repair-approval-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'repairRequestId', NEW.id,
          'repairTitle', NEW.title,
          'yachtName', v_display_name,
          'customerName', COALESCE(v_customer_name, ''),
          'actorName', v_actor_name,
          'eventType', 'approved',
          'estimatedCost', NEW.estimated_repair_cost
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error calling send-repair-approval-notification (approved): %', SQLERRM;
    END;

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    v_actor_id := NEW.approved_by;

    IF v_actor_id IS NOT NULL THEN
      SELECT COALESCE(up.first_name || ' ' || up.last_name, u.email, 'System')
      INTO v_actor_name
      FROM auth.users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = v_actor_id;
    ELSE
      v_actor_name := 'System';
    END IF;

    v_notification_message := format(
      'Repair request REJECTED: "%s" for %s. Rejected by: %s',
      NEW.title,
      v_display_name,
      v_actor_name
    );

    INSERT INTO admin_notifications (
      notification_type, reference_id, message, yacht_id, user_id
    ) VALUES (
      'repair_rejected', NEW.id, v_notification_message, NEW.yacht_id, NEW.submitted_by
    );

    INSERT INTO staff_messages (
      created_by, notification_type, reference_id, message
    ) VALUES (
      COALESCE(v_actor_id, NEW.submitted_by), 'repair_rejected', NEW.id, v_notification_message
    );

    BEGIN
      SELECT COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://eqiecntollhgfxmmbize.supabase.co'
      ) INTO v_supabase_url;

      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-repair-approval-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'repairRequestId', NEW.id,
          'repairTitle', NEW.title,
          'yachtName', v_display_name,
          'customerName', COALESCE(v_customer_name, ''),
          'actorName', v_actor_name,
          'eventType', 'rejected',
          'rejectionReason', NEW.approval_notes
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error calling send-repair-approval-notification (rejected): %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$;
