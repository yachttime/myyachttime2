/*
  # Add TTLock Support to Smart Lock System

  ## Summary
  Extends the existing smart lock system to support TTLock devices alongside Tuya devices.
  This migration adds multi-provider support, TTLock-specific fields, credentials storage,
  and OAuth token management.

  ## Database Changes

  ### 1. Update yacht_smart_devices table
  - Add `lock_provider` field to distinguish between 'tuya' and 'ttlock'
  - Add TTLock-specific fields:
    - `ttlock_lock_id` - TTLock platform lock identifier
    - `ttlock_lock_data` - Additional lock metadata from TTLock
    - `ttlock_mac_address` - Device MAC address for Bluetooth operations
    - `ttlock_ekey_id` - Electronic key ID for access management
    - `ttlock_lock_version` - Lock firmware version
  
  ### 2. Create ttlock_device_credentials table
  Stores TTLock API credentials per yacht (similar to tuya_device_credentials)
  - `id` - Unique credential set identifier
  - `yacht_id` - Reference to yachts table
  - `ttlock_client_id` - TTLock Open Platform client ID
  - `ttlock_client_secret` - TTLock client secret (encrypted)
  - `ttlock_username` - TTLock account username
  - `ttlock_password_md5` - MD5 hashed password for TTLock API
  - `is_active` - Whether credentials are currently active
  - `created_at`, `updated_at` - Timestamps
  - `created_by` - Manager who added credentials

  ### 3. Create ttlock_access_tokens table
  Caches OAuth access tokens to minimize API calls and improve performance
  - `id` - Unique token identifier
  - `yacht_id` - Reference to yachts table
  - `access_token` - OAuth access token
  - `uid` - TTLock user ID
  - `expires_at` - Token expiration timestamp
  - `created_at` - When token was obtained

  ### 4. Create ttlock_passcodes table
  Manages temporary passcodes for guest access
  - `id` - Unique passcode identifier
  - `device_id` - Reference to yacht_smart_devices
  - `yacht_id` - Reference to yachts table
  - `booking_id` - Optional reference to yacht_bookings
  - `passcode` - The actual passcode (4-9 digits)
  - `passcode_name` - Friendly name for the passcode
  - `ttlock_passcode_id` - TTLock platform passcode ID
  - `start_date`, `end_date` - Validity period
  - `is_active` - Whether passcode is currently active
  - `created_by` - User who created the passcode

  ## Security
  - Enable RLS on all new tables
  - Only managers can manage TTLock credentials
  - Managers can view/create/delete passcodes
  - Owners can view passcodes for their yacht during bookings
  - All authenticated users can view access tokens (needed for lock operations)

  ## Indexes
  - Index on lock_provider for provider-specific queries
  - Index on yacht_id for all new tables
  - Index on expires_at for token cleanup
  - Index on booking_id for booking-passcode lookups
*/

-- Add lock provider support to yacht_smart_devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_smart_devices' AND column_name = 'lock_provider'
  ) THEN
    ALTER TABLE yacht_smart_devices 
    ADD COLUMN lock_provider text DEFAULT 'tuya' CHECK (lock_provider IN ('tuya', 'ttlock'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_smart_devices' AND column_name = 'ttlock_lock_id'
  ) THEN
    ALTER TABLE yacht_smart_devices 
    ADD COLUMN ttlock_lock_id text,
    ADD COLUMN ttlock_lock_data jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN ttlock_mac_address text,
    ADD COLUMN ttlock_ekey_id text,
    ADD COLUMN ttlock_lock_version text;
  END IF;
END $$;

-- Create index on lock_provider
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_lock_provider 
  ON yacht_smart_devices(lock_provider);

-- Create ttlock_device_credentials table
CREATE TABLE IF NOT EXISTS ttlock_device_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  ttlock_client_id text NOT NULL,
  ttlock_client_secret text NOT NULL,
  ttlock_username text NOT NULL,
  ttlock_password_md5 text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  UNIQUE(yacht_id)
);

-- Create ttlock_access_tokens table for OAuth token caching
CREATE TABLE IF NOT EXISTS ttlock_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  uid bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(yacht_id)
);

-- Create ttlock_passcodes table for managing temporary access codes
CREATE TABLE IF NOT EXISTS ttlock_passcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES yacht_smart_devices(id) ON DELETE CASCADE,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES yacht_bookings(id) ON DELETE SET NULL,
  passcode text NOT NULL,
  passcode_name text NOT NULL,
  ttlock_passcode_id bigint,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES user_profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ttlock_device_credentials_yacht_id 
  ON ttlock_device_credentials(yacht_id);

CREATE INDEX IF NOT EXISTS idx_ttlock_access_tokens_yacht_id 
  ON ttlock_access_tokens(yacht_id);

CREATE INDEX IF NOT EXISTS idx_ttlock_access_tokens_expires_at 
  ON ttlock_access_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_ttlock_passcodes_device_id 
  ON ttlock_passcodes(device_id);

CREATE INDEX IF NOT EXISTS idx_ttlock_passcodes_yacht_id 
  ON ttlock_passcodes(yacht_id);

CREATE INDEX IF NOT EXISTS idx_ttlock_passcodes_booking_id 
  ON ttlock_passcodes(booking_id);

CREATE INDEX IF NOT EXISTS idx_ttlock_passcodes_dates 
  ON ttlock_passcodes(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE ttlock_device_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ttlock_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ttlock_passcodes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ttlock_device_credentials (same as tuya_device_credentials)

CREATE POLICY "Managers can view TTLock credentials"
  ON ttlock_device_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can insert TTLock credentials"
  ON ttlock_device_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can update TTLock credentials"
  ON ttlock_device_credentials
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

CREATE POLICY "Managers can delete TTLock credentials"
  ON ttlock_device_credentials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- RLS Policies for ttlock_access_tokens
-- All authenticated users can view tokens (needed for lock operations via edge function)

CREATE POLICY "Authenticated users can view TTLock access tokens"
  ON ttlock_access_tokens
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert TTLock access tokens"
  ON ttlock_access_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can update TTLock access tokens"
  ON ttlock_access_tokens
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

CREATE POLICY "Managers can delete TTLock access tokens"
  ON ttlock_access_tokens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- RLS Policies for ttlock_passcodes

CREATE POLICY "Managers can view all passcodes"
  ON ttlock_passcodes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Owners can view passcodes for their yacht"
  ON ttlock_passcodes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = ttlock_passcodes.yacht_id
    )
    OR
    EXISTS (
      SELECT 1 FROM yacht_bookings
      WHERE yacht_bookings.user_id = auth.uid()
      AND yacht_bookings.yacht_id = ttlock_passcodes.yacht_id
      AND yacht_bookings.start_date <= now()
      AND yacht_bookings.end_date >= now()
    )
  );

CREATE POLICY "Managers can insert passcodes"
  ON ttlock_passcodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can update passcodes"
  ON ttlock_passcodes
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

CREATE POLICY "Managers can delete passcodes"
  ON ttlock_passcodes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

-- Create trigger for updated_at on ttlock_device_credentials
DROP TRIGGER IF EXISTS update_ttlock_credentials_updated_at ON ttlock_device_credentials;
CREATE TRIGGER update_ttlock_credentials_updated_at
  BEFORE UPDATE ON ttlock_device_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_device_updated_at();

-- Add comment to explain the schema updates
COMMENT ON COLUMN yacht_smart_devices.lock_provider IS 'Lock provider: tuya or ttlock';
COMMENT ON TABLE ttlock_device_credentials IS 'Stores TTLock API credentials for yacht smart lock management';
COMMENT ON TABLE ttlock_access_tokens IS 'Caches TTLock OAuth access tokens to minimize API calls';
COMMENT ON TABLE ttlock_passcodes IS 'Manages temporary passcodes for guest access to TTLock devices';