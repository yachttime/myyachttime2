-- Remove "Check-in" / "Check-out" prefix from trip inspection notifications.
-- All trip inspections should simply be labeled "Trip inspection".

CREATE OR REPLACE FUNCTION create_notifications_for_trip_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_yacht_name text;
  v_inspector_name text;
  v_notification_message text;
  v_company_id uuid;
  v_recipient RECORD;
BEGIN
  -- Get yacht name and company_id
  SELECT name, company_id INTO v_yacht_name, v_company_id
  FROM yachts
  WHERE id = NEW.yacht_id;

  -- Get inspector name
  SELECT COALESCE(first_name || ' ' || last_name, 'Unknown Inspector')
  INTO v_inspector_name
  FROM user_profiles
  WHERE user_id = NEW.inspector_id;

  -- Build notification message (all types are simply "Trip inspection")
  v_notification_message := format(
    'Trip inspection completed for %s by %s',
    COALESCE(v_yacht_name, 'Unknown Yacht'),
    COALESCE(v_inspector_name, 'Unknown Inspector')
  );

  -- Insert one admin_notifications row for each staff, master, and mechanic user in the company
  FOR v_recipient IN
    SELECT user_id FROM user_profiles
    WHERE role IN ('staff', 'master', 'mechanic')
      AND company_id = v_company_id
      AND is_active = true
  LOOP
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id,
      company_id
    ) VALUES (
      'trip_inspection',
      NEW.id,
      v_notification_message,
      NEW.yacht_id,
      v_recipient.user_id,
      v_company_id
    );
  END LOOP;

  -- Insert one admin_notifications row for each manager assigned to this yacht
  FOR v_recipient IN
    SELECT user_id FROM user_profiles
    WHERE role = 'manager'
      AND yacht_id = NEW.yacht_id
      AND is_active = true
  LOOP
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id,
      company_id
    ) VALUES (
      'trip_inspection',
      NEW.id,
      v_notification_message,
      NEW.yacht_id,
      v_recipient.user_id,
      v_company_id
    );
  END LOOP;

  -- Broadcast to staff_messages feed
  INSERT INTO staff_messages (
    created_by,
    notification_type,
    reference_id,
    message,
    company_id
  ) VALUES (
    NEW.inspector_id,
    'trip_inspection',
    NEW.id,
    v_notification_message,
    v_company_id
  );

  -- Insert into yacht_history_logs
  INSERT INTO yacht_history_logs (
    yacht_id,
    yacht_name,
    action,
    created_by,
    created_by_name,
    reference_id,
    reference_type
  ) VALUES (
    NEW.yacht_id,
    v_yacht_name,
    'Trip inspection completed by ' || v_inspector_name,
    NEW.inspector_id,
    v_inspector_name,
    NEW.id,
    'trip_inspection'
  );

  RETURN NEW;
END;
$$;
