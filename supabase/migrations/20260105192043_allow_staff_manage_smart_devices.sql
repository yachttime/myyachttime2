/*
  # Allow Staff to Manage Smart Devices

  ## Summary
  Updates the Row Level Security policies for yacht_smart_devices and tuya_device_credentials
  to allow all staff members (admin, manager, mechanic) to view, insert, update, and delete
  smart devices and credentials, not just managers.

  ## Changes Made
  
  ### yacht_smart_devices table
  - Updated SELECT policy to use is_staff() function
  - Updated INSERT policy to use is_staff() function
  - Updated UPDATE policy to use is_staff() function
  - Updated DELETE policy to use is_staff() function
  
  ### tuya_device_credentials table
  - Updated SELECT policy to use is_staff() function
  - Updated INSERT policy to use is_staff() function
  - Updated UPDATE policy to use is_staff() function
  - Updated DELETE policy to use is_staff() function

  ## Security
  All policies still require authentication and use the existing is_staff() helper
  function which checks for admin, manager, or mechanic roles.
*/

-- Drop and recreate policies for yacht_smart_devices

-- Drop existing manager-only policies
DROP POLICY IF EXISTS "Managers can view all devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Managers can insert devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Managers can update devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Managers can delete devices" ON yacht_smart_devices;

-- Create new staff policies
CREATE POLICY "Staff can view all devices"
  ON yacht_smart_devices
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert devices"
  ON yacht_smart_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update devices"
  ON yacht_smart_devices
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete devices"
  ON yacht_smart_devices
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Drop and recreate policies for tuya_device_credentials

-- Drop existing manager-only policies
DROP POLICY IF EXISTS "Managers can view credentials" ON tuya_device_credentials;
DROP POLICY IF EXISTS "Managers can insert credentials" ON tuya_device_credentials;
DROP POLICY IF EXISTS "Managers can update credentials" ON tuya_device_credentials;
DROP POLICY IF EXISTS "Managers can delete credentials" ON tuya_device_credentials;

-- Create new staff policies
CREATE POLICY "Staff can view credentials"
  ON tuya_device_credentials
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert credentials"
  ON tuya_device_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update credentials"
  ON tuya_device_credentials
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete credentials"
  ON tuya_device_credentials
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Update smart_lock_access_logs policies as well

-- Drop existing manager-only policy
DROP POLICY IF EXISTS "Managers can view all logs" ON smart_lock_access_logs;

-- Create new staff policy
CREATE POLICY "Staff can view all logs"
  ON smart_lock_access_logs
  FOR SELECT
  TO authenticated
  USING (is_staff());