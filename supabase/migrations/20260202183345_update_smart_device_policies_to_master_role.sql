/*
  # Update Smart Device Policies to Master Role Only

  ## Summary
  Changes smart device management access from manager role to master role only.
  This ensures only users with the master role can manage smart locks, credentials,
  and related configurations.

  ## Changes

  ### 1. yacht_smart_devices Table
  - Drop existing manager-based policies
  - Create new master-based policies for all operations (SELECT, INSERT, UPDATE, DELETE)

  ### 2. smart_lock_access_logs Table
  - Update view policies to allow master role

  ### 3. tuya_device_credentials Table
  - Drop existing manager-based policies
  - Create new master-based policies for all operations

  ### 4. ttlock_device_credentials Table
  - Drop existing manager-based policies  
  - Create new master-based policies for all operations

  ### 5. ttlock_access_tokens Table
  - Drop existing manager-based policies
  - Create new master-based policies for INSERT, UPDATE, DELETE
  - Keep read access for all authenticated users (required for lock operations)

  ### 6. ttlock_passcodes Table
  - Drop existing manager-based policies
  - Create new master-based policies for all operations

  ## Security Impact
  - More restrictive access control
  - Only master role can configure and manage smart devices
  - Owners and guests retain ability to control locks (not affected)
  - Access logs remain viewable by appropriate roles
*/

-- yacht_smart_devices policies

DROP POLICY IF EXISTS "Managers can view all devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Managers can insert devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Managers can update devices" ON yacht_smart_devices;
DROP POLICY IF EXISTS "Managers can delete devices" ON yacht_smart_devices;

CREATE POLICY "Master can view all devices"
  ON yacht_smart_devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can insert devices"
  ON yacht_smart_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can update devices"
  ON yacht_smart_devices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can delete devices"
  ON yacht_smart_devices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- smart_lock_access_logs policies

DROP POLICY IF EXISTS "Managers can view all logs" ON smart_lock_access_logs;

CREATE POLICY "Master can view all logs"
  ON smart_lock_access_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- tuya_device_credentials policies

DROP POLICY IF EXISTS "Managers can view credentials" ON tuya_device_credentials;
DROP POLICY IF EXISTS "Managers can insert credentials" ON tuya_device_credentials;
DROP POLICY IF EXISTS "Managers can update credentials" ON tuya_device_credentials;
DROP POLICY IF EXISTS "Managers can delete credentials" ON tuya_device_credentials;

CREATE POLICY "Master can view credentials"
  ON tuya_device_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can insert credentials"
  ON tuya_device_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can update credentials"
  ON tuya_device_credentials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can delete credentials"
  ON tuya_device_credentials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- ttlock_device_credentials policies

DROP POLICY IF EXISTS "Managers can view TTLock credentials" ON ttlock_device_credentials;
DROP POLICY IF EXISTS "Managers can insert TTLock credentials" ON ttlock_device_credentials;
DROP POLICY IF EXISTS "Managers can update TTLock credentials" ON ttlock_device_credentials;
DROP POLICY IF EXISTS "Managers can delete TTLock credentials" ON ttlock_device_credentials;

CREATE POLICY "Master can view TTLock credentials"
  ON ttlock_device_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can insert TTLock credentials"
  ON ttlock_device_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can update TTLock credentials"
  ON ttlock_device_credentials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can delete TTLock credentials"
  ON ttlock_device_credentials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- ttlock_access_tokens policies

DROP POLICY IF EXISTS "Managers can insert TTLock access tokens" ON ttlock_access_tokens;
DROP POLICY IF EXISTS "Managers can update TTLock access tokens" ON ttlock_access_tokens;
DROP POLICY IF EXISTS "Managers can delete TTLock access tokens" ON ttlock_access_tokens;

CREATE POLICY "Master can insert TTLock access tokens"
  ON ttlock_access_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can update TTLock access tokens"
  ON ttlock_access_tokens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can delete TTLock access tokens"
  ON ttlock_access_tokens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- ttlock_passcodes policies

DROP POLICY IF EXISTS "Managers can view all passcodes" ON ttlock_passcodes;
DROP POLICY IF EXISTS "Managers can insert passcodes" ON ttlock_passcodes;
DROP POLICY IF EXISTS "Managers can update passcodes" ON ttlock_passcodes;
DROP POLICY IF EXISTS "Managers can delete passcodes" ON ttlock_passcodes;

CREATE POLICY "Master can view all passcodes"
  ON ttlock_passcodes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can insert passcodes"
  ON ttlock_passcodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can update passcodes"
  ON ttlock_passcodes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Master can delete passcodes"
  ON ttlock_passcodes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );