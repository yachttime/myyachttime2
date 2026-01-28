/*
  # Fix Yacht History Logs Trigger

  1. Changes
    - Update `create_notifications_for_repair_request` to use correct yacht_history_logs columns
    - Use `action` instead of `details`
    - Populate `yacht_name` and `created_by_name` denormalized fields

  2. Security
    - Function maintains SECURITY DEFINER for proper permissions
*/

-- Fix the repair request notification trigger function
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_yacht_name text;
  v_creator_name text;
BEGIN
  -- Insert admin notification
  INSERT INTO admin_notifications (
    notification_type,
    message,
    user_id,
    yacht_id,
    reference_id
  )
  VALUES (
    'repair_request',
    'New Repair Request: ' || NEW.description,
    NEW.submitted_by,
    NEW.yacht_id,
    NEW.id
  );

  -- Insert yacht history log if yacht_id exists
  IF NEW.yacht_id IS NOT NULL THEN
    -- Get yacht name
    SELECT name INTO v_yacht_name
    FROM yachts
    WHERE id = NEW.yacht_id;

    -- Get creator name
    SELECT COALESCE(first_name || ' ' || last_name, 'Unknown User')
    INTO v_creator_name
    FROM user_profiles
    WHERE user_id = NEW.submitted_by;

    INSERT INTO yacht_history_logs (
      yacht_id,
      yacht_name,
      action,
      created_by,
      created_by_name,
      reference_id,
      reference_type
    )
    VALUES (
      NEW.yacht_id,
      COALESCE(v_yacht_name, 'Unknown Yacht'),
      'Repair request submitted: ' || NEW.description,
      NEW.submitted_by,
      COALESCE(v_creator_name, 'Unknown User'),
      NEW.id,
      'repair_request'
    );
  END IF;

  -- Insert owner chat message if yacht_id exists
  IF NEW.yacht_id IS NOT NULL THEN
    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message
    )
    VALUES (
      NEW.yacht_id,
      NEW.submitted_by,
      'Repair request submitted: ' || NEW.description
    );
  END IF;

  RETURN NEW;
END;
$$;