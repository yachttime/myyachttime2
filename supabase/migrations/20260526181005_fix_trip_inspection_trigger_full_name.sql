/*
  # Fix trip inspection notification trigger - remove full_name reference

  ## Problem
  The live create_notifications_for_trip_inspection() function references
  full_name column on user_profiles, which does not exist. The correct
  columns are first_name and last_name. This causes every trip inspection
  insert to fail with "column full_name does not exist".

  ## Changes
  - Replaces the stale function body with the correct version that
    concatenates first_name || ' ' || last_name for the inspector name.
*/

CREATE OR REPLACE FUNCTION create_notifications_for_trip_inspection()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_inspector_name text;
  v_notification_message text;
  v_inspection_type_display text;
BEGIN
  -- Get yacht name
  SELECT name INTO v_yacht_name
  FROM yachts
  WHERE id = NEW.yacht_id;

  -- Get inspector name from user_profiles
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

  -- Create notification message
  v_notification_message := format(
    '%s inspection completed for %s by %s',
    v_inspection_type_display,
    COALESCE(v_yacht_name, 'Unknown Yacht'),
    COALESCE(v_inspector_name, 'Unknown Inspector')
  );

  -- Insert into admin_notifications
  INSERT INTO admin_notifications (
    notification_type,
    reference_id,
    message,
    yacht_id,
    user_id
  ) VALUES (
    'trip_inspection',
    NEW.id,
    v_notification_message,
    NEW.yacht_id,
    NEW.inspector_id
  );

  -- Insert into staff_messages
  INSERT INTO staff_messages (
    created_by,
    notification_type,
    reference_id,
    message
  ) VALUES (
    NEW.inspector_id,
    'trip_inspection',
    NEW.id,
    v_notification_message
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
