/*
  # Fix Notification Trigger Functions

  1. Changes
    - Update `create_notifications_for_repair_request` function to use correct column names
    - Update `notify_admin_new_user` function to use correct column names
    - Change `type` to `notification_type`
    - Remove non-existent `title` column references

  2. Security
    - Functions maintain SECURITY DEFINER for proper permissions
*/

-- Fix the repair request notification trigger function
CREATE OR REPLACE FUNCTION create_notifications_for_repair_request()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
    INSERT INTO yacht_history_logs (
      yacht_id,
      action,
      details,
      created_by,
      reference_id
    )
    VALUES (
      NEW.yacht_id,
      'repair_request_created',
      'Repair request submitted: ' || NEW.description,
      NEW.submitted_by,
      NEW.id
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

-- Fix the new user notification trigger function
CREATE OR REPLACE FUNCTION notify_admin_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO admin_notifications (
    notification_type,
    message,
    user_id,
    yacht_id
  )
  VALUES (
    'new_user',
    'New User Registration: ' || NEW.first_name || ' ' || NEW.last_name,
    NEW.user_id,
    NEW.yacht_id
  );

  RETURN NEW;
END;
$$;