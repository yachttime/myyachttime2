/*
  # Create Trigger for Trip Inspection Notifications

  1. Overview
    - Automatically creates admin notifications, staff messages, and yacht history logs when a trip inspection is submitted
    - Ensures managers and staff are notified of completed inspections
    - Eliminates need for manual notification creation in frontend code
    
  2. Changes
    - Create function to insert notifications and logs for new trip inspections
    - Create trigger that fires after trip_inspections insert
    
  3. Security
    - Function runs with SECURITY DEFINER to ensure it can insert notifications
    - Notifications are visible according to existing RLS policies
    
  4. Notification Details
    - Creates admin_notification for the yacht's managers and staff
    - Creates staff_message for all staff members
    - Creates yacht_history_log for activity tracking
    - Includes inspection type, yacht name, and inspector information
    - Triggers email notifications via existing notification triggers
*/

-- Create function to create notifications for new trip inspections
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

  -- Get inspector information
  SELECT 
    COALESCE(up.first_name || ' ' || up.last_name, u.email, 'Unknown Inspector')
  INTO v_inspector_name
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.user_id = u.id
  WHERE u.id = NEW.inspector_id;

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

  -- Insert into admin_notifications table
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

  -- Insert into staff_messages table
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

  -- Insert into yacht_history_logs table
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_trip_inspection_notifications ON trip_inspections;

-- Create trigger for trip inspections
CREATE TRIGGER trigger_trip_inspection_notifications
  AFTER INSERT ON trip_inspections
  FOR EACH ROW
  EXECUTE FUNCTION create_notifications_for_trip_inspection();