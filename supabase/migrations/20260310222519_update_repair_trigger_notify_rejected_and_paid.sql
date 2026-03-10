/*
  # Update Repair Request Trigger - Rejected & Paid Notifications

  1. Changes
    - Extends the repair request trigger to also fire the send-repair-approval-notification
      edge function when status changes to 'rejected'
    - Updates the payload to use the new unified interface:
        eventType: 'approved' | 'rejected'
        actorName: name of the person who approved/rejected
    - The 'paid' event is handled separately via the yacht_invoices trigger below

  2. New Trigger on yacht_invoices
    - Fires when payment_status changes to 'paid' AND repair_request_id IS NOT NULL
    - Looks up repair request and yacht info then calls the edge function with eventType: 'paid'

  3. Security
    - Both functions run with SECURITY DEFINER
    - No RLS changes
*/

-- Update the repair request notification trigger function
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
  v_owner_chat_message text;
  v_actor_name text;
  v_actor_id uuid;
  v_supabase_url text;
  v_event_type text;
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
    v_notification_message := format(
      'New repair request: "%s" for %s. Submitted by: %s',
      NEW.title,
      COALESCE(v_yacht_name, 'Retail Customer'),
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

  -- Handle UPDATE to 'approved' status
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
      COALESCE(v_yacht_name, 'Retail Customer'),
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
          'yachtName', COALESCE(v_yacht_name, 'Retail Customer'),
          'actorName', v_actor_name,
          'eventType', 'approved',
          'estimatedCost', NEW.estimated_repair_cost
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error calling send-repair-approval-notification (approved): %', SQLERRM;
    END;

  -- Handle UPDATE to 'rejected' status
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
      COALESCE(v_yacht_name, 'Retail Customer'),
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
          'yachtName', COALESCE(v_yacht_name, 'Retail Customer'),
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


-- Trigger function for yacht_invoices payment status changes
CREATE OR REPLACE FUNCTION notify_staff_repair_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_repair_request record;
  v_yacht_name text;
  v_actor_name text;
  v_supabase_url text;
BEGIN
  -- Only fire when payment_status changes to 'paid' and repair_request_id is set
  IF NEW.payment_status = 'paid'
    AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')
    AND NEW.repair_request_id IS NOT NULL
  THEN
    -- Get repair request details
    SELECT id, title, yacht_id, submitted_by
    INTO v_repair_request
    FROM repair_requests
    WHERE id = NEW.repair_request_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Get yacht name
    IF v_repair_request.yacht_id IS NOT NULL THEN
      SELECT name INTO v_yacht_name
      FROM yachts WHERE id = v_repair_request.yacht_id;
    END IF;

    -- Get actor name (who recorded the payment)
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
          'yachtName', COALESCE(v_yacht_name, 'Retail Customer'),
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

-- Create the trigger on yacht_invoices
DROP TRIGGER IF EXISTS trigger_repair_invoice_paid_notification ON yacht_invoices;
CREATE TRIGGER trigger_repair_invoice_paid_notification
  AFTER UPDATE ON yacht_invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_staff_repair_invoice_paid();
