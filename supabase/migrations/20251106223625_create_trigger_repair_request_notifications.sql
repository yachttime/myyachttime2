/*
  # Create Trigger for Repair Request Notifications

  1. Overview
    - Automatically creates admin notifications and staff messages when a repair request is submitted
    - Ensures managers and staff are notified of new repair requests
    
  2. Changes
    - Create function to insert notifications for new repair requests
    - Create trigger that fires after repair_requests insert
    - Backfill existing repair requests into notification tables
    
  3. Security
    - Function runs with SECURITY DEFINER to ensure it can insert notifications
    - Notifications are visible according to existing RLS policies
    
  4. Notification Details
    - Creates admin_notification for the yacht's managers
    - Creates staff_message for all staff members
    - Includes repair request title, yacht name, and submitter information
*/

-- Create function to create notifications for new repair requests
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
BEGIN
  -- Get yacht name
  SELECT name INTO v_yacht_name
  FROM yachts
  WHERE id = NEW.yacht_id;

  -- Get submitter information
  SELECT 
    COALESCE(up.first_name || ' ' || up.last_name, u.email, 'Unknown User'),
    u.email
  INTO v_submitter_name, v_submitter_email
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.user_id = u.id
  WHERE u.id = NEW.submitted_by;

  -- Create notification message
  v_notification_message := format(
    'New repair request: "%s" for %s. Submitted by: %s',
    NEW.title,
    COALESCE(v_yacht_name, 'Unknown Yacht'),
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_repair_request_notifications ON repair_requests;

-- Create trigger for repair requests
CREATE TRIGGER trigger_repair_request_notifications
  AFTER INSERT ON repair_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_notifications_for_repair_request();

-- Backfill existing repair requests into notification tables
DO $$
DECLARE
  repair_record RECORD;
  v_yacht_name text;
  v_submitter_name text;
  v_notification_message text;
BEGIN
  FOR repair_record IN 
    SELECT * FROM repair_requests
    WHERE NOT EXISTS (
      SELECT 1 FROM admin_notifications 
      WHERE admin_notifications.reference_id = repair_requests.id 
      AND admin_notifications.notification_type = 'repair_request'
    )
  LOOP
    -- Get yacht name
    SELECT name INTO v_yacht_name
    FROM yachts
    WHERE id = repair_record.yacht_id;

    -- Get submitter information
    SELECT 
      COALESCE(up.first_name || ' ' || up.last_name, u.email, 'Unknown User')
    INTO v_submitter_name
    FROM auth.users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = repair_record.submitted_by;

    -- Create notification message
    v_notification_message := format(
      'New repair request: "%s" for %s. Submitted by: %s',
      repair_record.title,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Insert into admin_notifications
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id,
      created_at
    ) VALUES (
      'repair_request',
      repair_record.id,
      v_notification_message,
      repair_record.yacht_id,
      repair_record.submitted_by,
      repair_record.created_at
    );

    -- Insert into staff_messages
    INSERT INTO staff_messages (
      created_by,
      notification_type,
      reference_id,
      message,
      created_at
    ) VALUES (
      repair_record.submitted_by,
      'repair_request',
      repair_record.id,
      v_notification_message,
      repair_record.created_at
    );
  END LOOP;
END $$;