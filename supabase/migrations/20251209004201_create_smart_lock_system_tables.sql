/*
  # Create Smart Lock System Tables

  ## Summary
  Creates the complete database infrastructure for the Tuya smart lock integration system,
  including device management, access logging, and secure credential storage.

  ## New Tables
  
  ### 1. yacht_smart_devices
  Stores information about all smart devices (locks, sensors, etc.) installed on yachts.
  - `id` (uuid, primary key) - Unique device identifier
  - `yacht_id` (uuid, foreign key) - Reference to yachts table
  - `device_type` (text) - Type of device (door_lock, sensor, etc.)
  - `device_name` (text) - Friendly name for the device
  - `location` (text) - Physical location on yacht (front_door, rear_door, etc.)
  - `tuya_device_id` (text) - Tuya Cloud platform device ID
  - `tuya_device_key` (text) - Tuya device local key (encrypted)
  - `manufacturer` (text) - Device manufacturer name
  - `model` (text) - Device model number
  - `installation_date` (timestamptz) - When device was installed
  - `battery_level` (int) - Current battery percentage (0-100)
  - `online_status` (boolean) - Whether device is currently online
  - `is_active` (boolean) - Whether device is active/enabled
  - `last_status_check` (timestamptz) - Last time status was checked
  - `metadata` (jsonb) - Additional device-specific data
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. smart_lock_access_logs
  Comprehensive audit log of all smart lock operations for security and tracking.
  - `id` (uuid, primary key) - Unique log entry identifier
  - `device_id` (uuid, foreign key) - Reference to yacht_smart_devices
  - `yacht_id` (uuid, foreign key) - Reference to yachts table
  - `user_id` (uuid, foreign key) - User who performed the action
  - `user_name` (text) - User's display name at time of action
  - `action_type` (text) - Type of action (unlock, lock, status_check)
  - `door_location` (text) - Which door was accessed
  - `success` (boolean) - Whether action succeeded
  - `error_message` (text) - Error details if action failed
  - `ip_address` (text) - IP address of user
  - `user_agent` (text) - Browser/device user agent
  - `timestamp` (timestamptz) - When action occurred
  - `metadata` (jsonb) - Additional context data
  
  ### 3. tuya_device_credentials
  Securely stores Tuya API credentials per yacht for device management.
  - `id` (uuid, primary key) - Unique credential set identifier
  - `yacht_id` (uuid, foreign key) - Reference to yachts table
  - `tuya_client_id` (text) - Tuya IoT platform client ID
  - `tuya_client_secret` (text) - Tuya IoT platform client secret (encrypted)
  - `tuya_region` (text) - Tuya cloud region (us, eu, cn, in)
  - `is_active` (boolean) - Whether credentials are active
  - `created_at` (timestamptz) - When credentials were added
  - `updated_at` (timestamptz) - Last credential update
  - `created_by` (uuid, foreign key) - Manager who added credentials

  ## Security
  
  ### yacht_smart_devices
  - Enable RLS on yacht_smart_devices table
  - Only managers can view, insert, update, and delete devices
  - Owners can view devices for their assigned yacht during active booking
  
  ### smart_lock_access_logs
  - Enable RLS on smart_lock_access_logs table
  - Managers can view all logs
  - Owners can view logs for their yacht
  - All authenticated users can insert logs (for their own actions)
  
  ### tuya_device_credentials
  - Enable RLS on tuya_device_credentials table
  - Only managers can view/manage credentials
  - Strict access control for sensitive API credentials

  ## Indexes
  - Index on yacht_id for fast yacht-specific queries
  - Index on device_id for log lookups
  - Index on user_id for user activity queries
  - Index on timestamp for chronological sorting
  - Index on device_type and location for filtering
*/

-- Create yacht_smart_devices table
CREATE TABLE IF NOT EXISTS yacht_smart_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  device_type text NOT NULL DEFAULT 'door_lock',
  device_name text NOT NULL,
  location text NOT NULL,
  tuya_device_id text,
  tuya_device_key text,
  manufacturer text,
  model text,
  installation_date timestamptz DEFAULT now(),
  battery_level int DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
  online_status boolean DEFAULT false,
  is_active boolean DEFAULT true,
  last_status_check timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create smart_lock_access_logs table
CREATE TABLE IF NOT EXISTS smart_lock_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES yacht_smart_devices(id) ON DELETE CASCADE,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('unlock', 'lock', 'status_check', 'failed_attempt')),
  door_location text NOT NULL,
  success boolean DEFAULT true,
  error_message text,
  ip_address text,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create tuya_device_credentials table
CREATE TABLE IF NOT EXISTS tuya_device_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  tuya_client_id text NOT NULL,
  tuya_client_secret text NOT NULL,
  tuya_region text NOT NULL DEFAULT 'us' CHECK (tuya_region IN ('us', 'eu', 'cn', 'in')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  UNIQUE(yacht_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_yacht_id ON yacht_smart_devices(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_device_type ON yacht_smart_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_location ON yacht_smart_devices(location);
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_is_active ON yacht_smart_devices(is_active);

CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_device_id ON smart_lock_access_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_yacht_id ON smart_lock_access_logs(yacht_id);
CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_user_id ON smart_lock_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_timestamp ON smart_lock_access_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_smart_lock_access_logs_action_type ON smart_lock_access_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_tuya_device_credentials_yacht_id ON tuya_device_credentials(yacht_id);

-- Enable Row Level Security
ALTER TABLE yacht_smart_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_lock_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuya_device_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for yacht_smart_devices

-- Managers can view all devices
CREATE POLICY "Managers can view all devices"
  ON yacht_smart_devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Owners can view devices for their yacht during active booking
CREATE POLICY "Owners can view devices for their yacht"
  ON yacht_smart_devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = yacht_smart_devices.yacht_id
    )
    OR
    EXISTS (
      SELECT 1 FROM yacht_bookings
      WHERE yacht_bookings.user_id = auth.uid()
      AND yacht_bookings.yacht_id = yacht_smart_devices.yacht_id
      AND yacht_bookings.start_date <= now()
      AND yacht_bookings.end_date >= now()
    )
  );

-- Managers can insert devices
CREATE POLICY "Managers can insert devices"
  ON yacht_smart_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Managers can update devices
CREATE POLICY "Managers can update devices"
  ON yacht_smart_devices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Managers can delete devices
CREATE POLICY "Managers can delete devices"
  ON yacht_smart_devices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- RLS Policies for smart_lock_access_logs

-- Managers can view all logs
CREATE POLICY "Managers can view all logs"
  ON smart_lock_access_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Owners can view logs for their yacht
CREATE POLICY "Owners can view logs for their yacht"
  ON smart_lock_access_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = smart_lock_access_logs.yacht_id
    )
  );

-- All authenticated users can insert logs for their own actions
CREATE POLICY "Users can insert their own logs"
  ON smart_lock_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tuya_device_credentials

-- Managers can view credentials
CREATE POLICY "Managers can view credentials"
  ON tuya_device_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Managers can insert credentials
CREATE POLICY "Managers can insert credentials"
  ON tuya_device_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Managers can update credentials
CREATE POLICY "Managers can update credentials"
  ON tuya_device_credentials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Managers can delete credentials
CREATE POLICY "Managers can delete credentials"
  ON tuya_device_credentials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_smart_device_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_yacht_smart_devices_updated_at ON yacht_smart_devices;
CREATE TRIGGER update_yacht_smart_devices_updated_at
  BEFORE UPDATE ON yacht_smart_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_device_updated_at();

DROP TRIGGER IF EXISTS update_tuya_credentials_updated_at ON tuya_device_credentials;
CREATE TRIGGER update_tuya_credentials_updated_at
  BEFORE UPDATE ON tuya_device_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_device_updated_at();