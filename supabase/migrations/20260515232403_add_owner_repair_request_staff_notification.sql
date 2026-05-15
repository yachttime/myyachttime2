/*
  # Notify staff/master when an owner submits a repair request

  ## Summary
  When an owner (non-retail customer) submits a new repair request, the trigger
  now calls the `send-owner-repair-notification` edge function, which sends an
  email and SMS to all active staff and master users so they are immediately
  aware of the incoming request.

  ## Changes
  - Updated `create_notifications_for_repair_request()` trigger function
  - On INSERT, if `is_retail_customer = false` (owner request), an async HTTP
    call is made to `/functions/v1/send-owner-repair-notification` with the
    repair title, description, yacht name, and submitter name.
  - All existing INSERT/UPDATE behavior is preserved unchanged.
*/

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
$$;
