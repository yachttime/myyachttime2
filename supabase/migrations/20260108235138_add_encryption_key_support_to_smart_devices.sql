/*
  # Add Encryption Key Support for jtmspro Smart Locks

  ## Summary
  Adds support for encrypted remote unlock functionality required by jtmspro category smart locks.
  These locks require a secure key exchange before remote unlocking is possible.

  ## Changes Made
  
  ### yacht_smart_devices table modifications:
  1. **device_category** (text) - Stores the Tuya device category (e.g., "jtmspro")
  2. **encryption_key** (text) - Securely stores the encryption key for remote unlock
  3. **encryption_key_set_at** (timestamptz) - Timestamp when encryption key was last set
  4. **requires_key_setup** (boolean) - Flag indicating if device needs key setup before use

  ## Security Notes
  - Encryption keys are stored in the database and should be treated as sensitive data
  - Keys are generated server-side and never exposed to the client
  - Key rotation is supported by updating the encryption_key and encryption_key_set_at fields
  - RLS policies ensure only authorized managers can view/modify encryption keys
*/

-- Add new columns to yacht_smart_devices table
DO $$
BEGIN
  -- Add device_category column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_smart_devices' AND column_name = 'device_category'
  ) THEN
    ALTER TABLE yacht_smart_devices ADD COLUMN device_category text;
  END IF;

  -- Add encryption_key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_smart_devices' AND column_name = 'encryption_key'
  ) THEN
    ALTER TABLE yacht_smart_devices ADD COLUMN encryption_key text;
  END IF;

  -- Add encryption_key_set_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_smart_devices' AND column_name = 'encryption_key_set_at'
  ) THEN
    ALTER TABLE yacht_smart_devices ADD COLUMN encryption_key_set_at timestamptz;
  END IF;

  -- Add requires_key_setup column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_smart_devices' AND column_name = 'requires_key_setup'
  ) THEN
    ALTER TABLE yacht_smart_devices ADD COLUMN requires_key_setup boolean DEFAULT false;
  END IF;
END $$;

-- Create index for devices that need key setup
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_requires_setup 
  ON yacht_smart_devices(requires_key_setup) 
  WHERE requires_key_setup = true;

-- Create index for device category
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_category 
  ON yacht_smart_devices(device_category);
