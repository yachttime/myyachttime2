/*
  # Update Repair Request Trigger to Include Owner Chat Messages

  1. Overview
    - Updates the repair request notification trigger to also create messages in owner_chat_messages
    - Ensures yacht owners are notified of repair requests through their chat interface
    - Maintains consistency with maintenance request notification pattern

  2. Changes
    - Modify create_notifications_for_repair_request function to insert into owner_chat_messages
    - Add messages visible to all yacht owners, not just staff
    - Include repair request details in the owner chat message

  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS for insertions
    - Messages are visible according to existing RLS policies

  4. Notification Flow
    - Creates admin_notification for managers (existing)
    - Creates staff_message for staff members (existing)
    - Creates owner_chat_message for yacht owners (new)
*/

-- Drop and recreate the function with owner chat message support
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_yacht_name text;
  v_submitter_name text;
  v_submitter_email text;
  v_notification_message text;
  v_owner_chat_message text;
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger is already created, no need to recreate it
-- The existing trigger will use the updated function

-- Backfill owner chat messages for existing repair requests that don't have them
DO $$
DECLARE
  repair_record RECORD;
  v_yacht_name text;
  v_submitter_name text;
  v_owner_chat_message text;
BEGIN
  FOR repair_record IN
    SELECT rr.*
    FROM repair_requests rr
    WHERE NOT EXISTS (
      SELECT 1 FROM owner_chat_messages ocm
      WHERE ocm.message LIKE 'Repair Request Submitted: ' || rr.title || '%'
      AND ocm.yacht_id = rr.yacht_id
      AND ocm.created_at >= rr.created_at - interval '1 minute'
      AND ocm.created_at <= rr.created_at + interval '1 minute'
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

    -- Create owner chat message
    v_owner_chat_message := format(
      'Repair Request Submitted: %s' || E'\n\n' || '%s' || E'\n\n' || 'Submitted by: %s',
      repair_record.title,
      COALESCE(repair_record.description, 'No description provided'),
      COALESCE(v_submitter_name, 'Unknown User')
    );

    -- Insert into owner_chat_messages
    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message,
      created_at
    ) VALUES (
      repair_record.yacht_id,
      repair_record.submitted_by,
      v_owner_chat_message,
      repair_record.created_at
    );
  END LOOP;
END $$;
