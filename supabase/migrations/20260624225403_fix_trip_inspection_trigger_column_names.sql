-- Fix trip inspection trigger: staff_messages has no yacht_id, yacht_history_logs uses created_by not user_id
CREATE OR REPLACE FUNCTION create_notifications_for_trip_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yacht_name text;
  inspector_name text;
  notif_message text;
  recipient RECORD;
  yacht_company_id uuid;
BEGIN
  -- Get yacht name and company_id
  SELECT name, company_id INTO yacht_name, yacht_company_id
  FROM yachts WHERE id = NEW.yacht_id;

  -- Get inspector full name
  SELECT COALESCE(first_name || ' ' || last_name, 'Staff') INTO inspector_name
  FROM user_profiles WHERE user_id = NEW.inspector_id;

  notif_message := 'Trip inspection ready for review — ' || COALESCE(yacht_name, 'Unknown Yacht') || ' by ' || COALESCE(inspector_name, 'Inspector');

  -- Create per-recipient admin_notifications for staff, master users in same company
  FOR recipient IN
    SELECT up.user_id
    FROM user_profiles up
    WHERE up.role IN ('staff', 'master')
      AND up.is_active = true
      AND up.company_id = yacht_company_id
      AND up.user_id != NEW.inspector_id
  LOOP
    INSERT INTO admin_notifications (user_id, notification_type, message, reference_id, yacht_id)
    VALUES (recipient.user_id, 'trip_inspection', notif_message, NEW.id, NEW.yacht_id);
  END LOOP;

  -- Also notify managers assigned to this yacht
  FOR recipient IN
    SELECT DISTINCT up.user_id
    FROM user_profiles up
    JOIN yacht_bookings yb ON yb.user_id = up.user_id
    WHERE up.role = 'manager'
      AND yb.yacht_id = NEW.yacht_id
      AND up.is_active = true
      AND up.company_id = yacht_company_id
      AND up.user_id != NEW.inspector_id
  LOOP
    INSERT INTO admin_notifications (user_id, notification_type, message, reference_id, yacht_id)
    VALUES (recipient.user_id, 'trip_inspection', notif_message, NEW.id, NEW.yacht_id);
  END LOOP;

  -- Staff messages broadcast (no yacht_id column on staff_messages)
  INSERT INTO staff_messages (created_by, message, notification_type, reference_id, company_id)
  VALUES (NEW.inspector_id, notif_message, 'trip_inspection', NEW.id, yacht_company_id);

  -- Yacht history log (uses created_by, not user_id)
  INSERT INTO yacht_history_logs (yacht_id, yacht_name, action, created_by, created_by_name, reference_id, reference_type)
  VALUES (NEW.yacht_id, yacht_name, 'Trip inspection submitted — ready for review by ' || COALESCE(inspector_name, 'Inspector'), NEW.inspector_id, inspector_name, NEW.id, 'trip_inspection');

  RETURN NEW;
END;
$$;
