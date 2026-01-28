/*
  # Fix log_new_user_activity Function

  1. Changes
    - Update `log_new_user_activity` function to use correct yacht_history_logs columns
    - Remove reference to non-existent `details` column
    - Use `action` column for the activity description
    - Populate `yacht_name` and `created_by_name` denormalized fields
    - Add `reference_id` and `reference_type` for proper tracking

  2. Security
    - Function maintains SECURITY DEFINER for proper permissions
*/

CREATE OR REPLACE FUNCTION public.log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  yacht_name_var TEXT;
  user_name TEXT;
BEGIN
  -- Only log if user is associated with a yacht
  IF NEW.yacht_id IS NOT NULL THEN
    -- Get yacht name
    SELECT name INTO yacht_name_var FROM yachts WHERE id = NEW.yacht_id;
    
    -- Build user name
    user_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email);

    -- Create yacht history log
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
      COALESCE(yacht_name_var, 'Unknown Yacht'),
      'New user registered: ' || user_name || 
      CASE 
        WHEN NEW.role IS NOT NULL THEN ' (Role: ' || NEW.role || ')'
        ELSE ''
      END,
      NEW.user_id,
      COALESCE(user_name, 'Unknown User'),
      NEW.user_id,
      'user_profile'
    );
  END IF;

  RETURN NEW;
END;
$$;