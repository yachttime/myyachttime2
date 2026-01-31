/*
  # Fix Appointment Trigger Column Names

  1. Changes
    - Update `create_staff_message_for_appointment()` function to use correct column names
    - Use `notification_type` instead of `message_type`
    - Use the correct staff_messages table schema
    - Reference the appointments table correctly

  2. Notes
    - This fixes the error when users try to create appointments
    - The function was using non-existent columns in staff_messages
*/

-- Fix the create_staff_message_for_appointment function to use correct columns
CREATE OR REPLACE FUNCTION public.create_staff_message_for_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO staff_messages (
    created_by,
    notification_type,
    reference_id,
    message
  )
  VALUES (
    NEW.created_by,
    'appointment',
    NEW.id,
    format('New appointment: %s for %s on %s at %s. Contact: %s, %s. Issue: %s',
      NEW.name,
      NEW.yacht_name,
      NEW.date,
      NEW.time,
      NEW.phone,
      NEW.email,
      NEW.problem_description
    )
  );
  
  RETURN NEW;
END;
$$;
