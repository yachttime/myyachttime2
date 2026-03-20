/*
  # Fix Repair Approval Notification - Include Customer Name for Retail Customers

  1. Problem
    - When a repair request has no yacht_id (retail customer), the email shows "Yacht: Retail Customer"
    - There is no customer name, yacht name, or any identifying info in the notification
    - Staff cannot tell who approved or what customer the repair is for

  2. Fix
    - Add v_customer_name variable to store the repair request's customer_name field
    - Build a display name that includes both customer name and yacht name when available
    - Pass customerName in the payload to the edge function for all three event types
    - Same fix applied to the yacht_invoices paid trigger

  3. No RLS or security changes
*/

CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_customer_name text;
  v_display_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
  v_owner_chat_message text;
  v_actor_name text;
  v_actor_id uuid;
  v_supabase_url text;
  v_event_type text;
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

    v_owner_chat_message := format(
      'Repair Request Submitted: %s' || E'\n\n' || '%s' || E'\n\n' || 'Submitted by: %s',
      NEW.title,
      COALESCE(NEW.description, 'No description provided'),
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

    IF NEW.yacht_id IS NOT NULL THEN
      INSERT INTO owner_chat_messages (yacht_id, user_id, message)
      VALUES (NEW.yacht_id, NEW.submitted_by, v_owner_chat_message);
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_event_type := 'approved';
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

    IF NEW.yacht_id IS NOT NULL THEN
      v_owner_chat_message := format(
        'Repair Request APPROVED: %s' || E'\n\n' || 'Estimated Cost: %s' || E'\n\n' || 'Approved by: %s',
        NEW.title,
        COALESCE('$' || NEW.estimated_repair_cost, 'TBD'),
        v_actor_name
      );

      INSERT INTO owner_chat_messages (yacht_id, user_id, message)
      VALUES (NEW.yacht_id, COALESCE(v_actor_id, NEW.submitted_by), v_owner_chat_message);
    END IF;

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
    v_event_type := 'rejected';
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

    IF NEW.yacht_id IS NOT NULL THEN
      v_owner_chat_message := format(
        'Repair Request REJECTED: %s' || E'\n\n' || 'Reason: %s' || E'\n\n' || 'Rejected by: %s',
        NEW.title,
        COALESCE(NEW.approval_notes, 'No reason provided'),
        v_actor_name
      );

      INSERT INTO owner_chat_messages (yacht_id, user_id, message)
      VALUES (NEW.yacht_id, COALESCE(v_actor_id, NEW.submitted_by), v_owner_chat_message);
    END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION notify_staff_repair_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_repair_request record;
  v_yacht_name text;
  v_customer_name text;
  v_display_name text;
  v_actor_name text;
  v_supabase_url text;
BEGIN
  IF NEW.payment_status = 'paid'
    AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')
    AND NEW.repair_request_id IS NOT NULL
  THEN
    SELECT id, title, yacht_id, submitted_by, customer_name
    INTO v_repair_request
    FROM repair_requests
    WHERE id = NEW.repair_request_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    IF v_repair_request.yacht_id IS NOT NULL THEN
      SELECT name INTO v_yacht_name
      FROM yachts WHERE id = v_repair_request.yacht_id;
    END IF;

    v_customer_name := v_repair_request.customer_name;

    IF v_yacht_name IS NOT NULL AND v_customer_name IS NOT NULL THEN
      v_display_name := v_yacht_name || ' (' || v_customer_name || ')';
    ELSIF v_yacht_name IS NOT NULL THEN
      v_display_name := v_yacht_name;
    ELSIF v_customer_name IS NOT NULL THEN
      v_display_name := v_customer_name;
    ELSE
      v_display_name := 'Retail Customer';
    END IF;

    IF NEW.billed_by IS NOT NULL THEN
      SELECT COALESCE(up.first_name || ' ' || up.last_name, u.email, 'System')
      INTO v_actor_name
      FROM auth.users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = NEW.billed_by;
    ELSE
      v_actor_name := 'System';
    END IF;

    BEGIN
      SELECT COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://eqiecntollhgfxmmbize.supabase.co'
      ) INTO v_supabase_url;

      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-repair-approval-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'repairRequestId', v_repair_request.id,
          'repairTitle', v_repair_request.title,
          'yachtName', v_display_name,
          'customerName', COALESCE(v_customer_name, ''),
          'actorName', v_actor_name,
          'eventType', 'paid',
          'finalAmount', NEW.final_invoice_amount::text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error calling send-repair-approval-notification (paid): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
