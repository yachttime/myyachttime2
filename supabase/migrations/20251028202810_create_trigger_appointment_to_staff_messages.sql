/*
  # Create trigger to automatically add appointments to staff_messages

  1. Changes
    - Create a function that inserts a staff message when an appointment is created
    - Create a trigger that calls this function after appointment insert
    - Backfill existing appointments into staff_messages

  2. Notes
    - This ensures all appointments automatically appear in staff messages
    - Backfills existing appointments so they appear in the staff messages view
*/

-- Create function to insert staff message for new appointments
CREATE OR REPLACE FUNCTION create_staff_message_for_appointment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO staff_messages (
    created_by,
    notification_type,
    reference_id,
    message
  ) VALUES (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for appointments
DROP TRIGGER IF EXISTS trigger_appointment_staff_message ON appointments;
CREATE TRIGGER trigger_appointment_staff_message
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_staff_message_for_appointment();

-- Backfill existing appointments into staff_messages
INSERT INTO staff_messages (created_by, notification_type, reference_id, message, created_at)
SELECT 
  created_by,
  'appointment',
  id,
  format('New appointment: %s for %s on %s at %s. Contact: %s, %s. Issue: %s',
    name,
    yacht_name,
    date,
    time,
    phone,
    email,
    problem_description
  ),
  created_at
FROM appointments
WHERE NOT EXISTS (
  SELECT 1 FROM staff_messages 
  WHERE staff_messages.reference_id = appointments.id 
  AND staff_messages.notification_type = 'appointment'
);