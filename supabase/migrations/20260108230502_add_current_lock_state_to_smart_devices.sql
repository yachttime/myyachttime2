/*
  # Add Current Lock State Tracking

  1. Changes
    - Add `current_lock_state` column to `yacht_smart_devices` table
      - Tracks the current known state of the lock (locked/unlocked)
      - Defaults to `true` (locked) for safety
      - Updated whenever lock/unlock commands succeed
    
  2. Notes
    - For professional locks that don't report state, we track it in our database
    - This provides a reliable source of truth for lock status
    - State is updated after successful lock/unlock operations
*/

-- Add current lock state column
ALTER TABLE yacht_smart_devices
ADD COLUMN IF NOT EXISTS current_lock_state boolean DEFAULT true;

-- Set initial state based on last successful lock/unlock action
DO $$
DECLARE
  device_record RECORD;
  last_action_record RECORD;
BEGIN
  FOR device_record IN 
    SELECT id FROM yacht_smart_devices WHERE device_type = 'door_lock'
  LOOP
    -- Get the most recent successful lock/unlock action for this device
    SELECT action_type INTO last_action_record
    FROM smart_lock_access_logs
    WHERE device_id = device_record.id
      AND success = true
      AND action_type IN ('lock', 'unlock')
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Update the device's current state based on last action
    IF last_action_record.action_type IS NOT NULL THEN
      UPDATE yacht_smart_devices
      SET current_lock_state = (last_action_record.action_type = 'lock')
      WHERE id = device_record.id;
    END IF;
  END LOOP;
END $$;