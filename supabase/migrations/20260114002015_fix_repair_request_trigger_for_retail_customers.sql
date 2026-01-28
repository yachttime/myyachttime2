/*
  # Fix Repair Request Trigger for Retail Customers

  1. Changes
    - Update trigger function to handle null yacht_id for retail customers
    - Only create admin_notifications for yacht-based repair requests
    - Continue creating staff_messages for all repair requests (both yacht and retail)
    
  2. Behavior
    - Yacht customers: Creates both admin_notifications and staff_messages
    - Retail customers: Only creates staff_messages
    
  3. Security
    - No changes to security model
    - Maintains SECURITY DEFINER for notification creation
*/

-- Update function to handle retail customers
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
BEGIN
  -- Get submitter information
  SELECT 
    COALESCE(up.first_name || ' ' || up.last_name, u.email, 'Unknown User'),
    u.email
  INTO v_submitter_name, v_submitter_email
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.user_id = u.id
  WHERE u.id = NEW.submitted_by;

  -- Handle yacht-based repair requests
  IF NEW.yacht_id IS NOT NULL THEN
    -- Get yacht name
    SELECT name INTO v_yacht_name
    FROM yachts
    WHERE id = NEW.yacht_id;

    -- Create notification message for yacht customers
    v_notification_message := format(
      'New repair request: "%s" for %s. Submitted by: %s',
      NEW.title,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Insert into admin_notifications table (only for yacht customers)
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
  ELSE
    -- Handle retail customers
    v_notification_message := format(
      'New retail customer repair request: "%s" from %s (%s). Submitted by: %s',
      NEW.title,
      COALESCE(NEW.customer_name, 'Unknown Customer'),
      COALESCE(NEW.customer_phone, 'No phone'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Only insert into staff_messages for retail customers
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
