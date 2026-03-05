/*
  # Link Appointments to Daily Tasks & Add Staff Assignment to Appointments

  ## Summary
  This migration creates the bridge between the appointments system and the daily tasks
  system, allowing appointments to be assigned to staff members and tracked as daily tasks.

  ## Changes

  ### 1. appointments table
  - Add `assigned_to` (uuid, nullable) - FK to user_profiles, the staff member assigned to handle this appointment

  ### 2. daily_tasks table
  - Add `appointment_id` (uuid, nullable) - FK to appointments, links a daily task back to its source appointment
  - Add `task_type` (text, default 'manual') - distinguishes between 'manual' tasks and 'appointment' tasks

  ## Security
  - No RLS changes needed; existing policies cover the new columns
  - The appointment_id FK allows joining for display purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE appointments ADD COLUMN assigned_to uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_tasks' AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE daily_tasks ADD COLUMN appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_tasks' AND column_name = 'task_type'
  ) THEN
    ALTER TABLE daily_tasks ADD COLUMN task_type text NOT NULL DEFAULT 'manual' CHECK (task_type IN ('manual', 'appointment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_appointment_id ON daily_tasks(appointment_id);
