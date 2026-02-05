/*
  # Add Staff Notifications for Repair Request Approvals

  1. Overview
    - Sends notifications to all staff and master users when a repair request is approved
    - Extends existing repair request notification system to handle status updates
    - Notifies team members when repair work can proceed

  2. Changes
    - Modify the repair request trigger to fire on both INSERT and UPDATE
    - Add logic to detect when status changes to 'approved'
    - Send staff_message and admin_notification when approval occurs
    - Include approval details in the notification

  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS for insertions
    - Notifications are visible according to existing RLS policies

  4. Notification Flow
    - On INSERT: Creates notifications for new repair requests (existing behavior)
    - On UPDATE to 'approved': Creates notifications for all staff/masters about approval
*/

-- Update the function to handle both INSERT and UPDATE operations
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
  v_owner_chat_message text;
  v_approver_name text;
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

  -- Handle INSERT (new repair request)
  IF TG_OP = 'INSERT' THEN
    -- Create notification message for staff
    v_notification_message := format(
      'New repair request: "%s" for %s. Submitted by: %s',
      NEW.title,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Create owner chat message with more details
    v_owner_chat_message := format(
      'Repair Request Submitted: %s' || E'\n\n' || '%s' || E'\n\n' || 'Submitted by: %s',
      NEW.title,
      COALESCE(NEW.description, 'No description provided'),
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

    -- Insert into owner_chat_messages table so yacht owners can see the repair request
    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message
    ) VALUES (
      NEW.yacht_id,
      NEW.submitted_by,
      v_owner_chat_message
    );

  -- Handle UPDATE (status change to approved)
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get approver name if available
    IF NEW.approved_by IS NOT NULL THEN
      SELECT COALESCE(up.first_name || ' ' || up.last_name, u.email, 'System')
      INTO v_approver_name
      FROM auth.users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = NEW.approved_by;
    ELSE
      v_approver_name := 'System';
    END IF;

    -- Create approval notification message
    v_notification_message := format(
      'Repair request APPROVED: "%s" for %s. Approved by: %s',
      NEW.title,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      v_approver_name
    );

    -- Insert into admin_notifications for all staff to see
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id
    ) VALUES (
      'repair_approved',
      NEW.id,
      v_notification_message,
      NEW.yacht_id,
      NEW.submitted_by
    );

    -- Insert into staff_messages table to notify all staff/masters
    INSERT INTO staff_messages (
      created_by,
      notification_type,
      reference_id,
      message
    ) VALUES (
      COALESCE(NEW.approved_by, NEW.submitted_by),
      'repair_approved',
      NEW.id,
      v_notification_message
    );

    -- Also add to owner chat so the yacht owner knows it was approved
    v_owner_chat_message := format(
      'Repair Request APPROVED: %s' || E'\n\n' || 'Estimated Cost: %s' || E'\n\n' || 'Approved by: %s',
      NEW.title,
      COALESCE('$' || NEW.estimated_repair_cost, 'TBD'),
      v_approver_name
    );

    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message
    ) VALUES (
      NEW.yacht_id,
      COALESCE(NEW.approved_by, NEW.submitted_by),
      v_owner_chat_message
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to fire on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_repair_request_notifications ON repair_requests;

CREATE TRIGGER trigger_repair_request_notifications
  AFTER INSERT OR UPDATE ON repair_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_notifications_for_repair_request();
