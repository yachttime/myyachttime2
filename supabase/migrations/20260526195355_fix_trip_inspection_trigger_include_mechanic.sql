/*
  # Fix trip inspection trigger to include mechanic role

  The trigger was only inserting admin_notifications for staff and master users.
  Mechanics are active field users who also need to see trip inspection notifications.

  ## Changes
  - Updates `create_notifications_for_trip_inspection()` to loop through
    staff, master, AND mechanic roles (excluding the inspector themselves
    to avoid a self-notification)
*/

CREATE OR REPLACE FUNCTION create_notifications_for_trip_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_yacht_name text;
  v_inspector_name text;
  v_notification_message text;
  v_inspection_type_display text;
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

  -- Format inspection type for display
  v_inspection_type_display := CASE
    WHEN NEW.inspection_type = 'check_in' THEN 'Check-in'
    WHEN NEW.inspection_type = 'check_out' THEN 'Check-out'
    ELSE 'Trip'
  END;

  -- Build notification message
  v_notification_message := format(
    '%s inspection completed for %s by %s',
    v_inspection_type_display,
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
    'Post trip inspection completed by ' || v_inspector_name,
    NEW.inspector_id,
    v_inspector_name,
    NEW.id,
    'trip_inspection'
  );

  RETURN NEW;
END;
$$;
