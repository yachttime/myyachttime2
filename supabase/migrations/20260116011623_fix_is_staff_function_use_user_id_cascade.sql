/*
  # Fix is_staff Function to Use Correct Column

  1. Problem
    - The is_staff() function checks `id = auth.uid()` but should check `user_id = auth.uid()`
    - This prevents staff from accessing data they should be able to see
  
  2. Solution
    - Drop and recreate both overloads of is_staff() to use the correct column
    - First overload (no args): Check `user_id = auth.uid()`
    - Second overload (with uuid): Check `user_id = user_uuid`
  
  3. Impact
    - Staff users will now be properly recognized by RLS policies
    - User management and other staff features will work correctly
    - All dependent policies will be automatically recreated
*/

-- Drop existing functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS is_staff() CASCADE;
DROP FUNCTION IF EXISTS is_staff(uuid) CASCADE;

-- Recreate is_staff function without parameters (checks current user)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'manager', 'mechanic')
    AND is_active = true
  );
END;
$$;

-- Recreate is_staff function with user_uuid parameter (checks specific user)
CREATE OR REPLACE FUNCTION is_staff(user_uuid uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = user_uuid
    AND role IN ('admin', 'staff', 'manager', 'mechanic')
    AND is_active = true
  );
END;
$$;

-- Recreate all the RLS policies that depend on is_staff()

-- user_profiles policies
CREATE POLICY "Users can view own profile and staff can view all"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_staff());

CREATE POLICY "Users can update own profile and staff can update all"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_staff())
  WITH CHECK (user_id = auth.uid() OR is_staff());

-- yachts policies
CREATE POLICY "Staff can insert yachts"
  ON yachts FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update yachts"
  ON yachts FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete yachts"
  ON yachts FOR DELETE
  TO authenticated
  USING (is_staff());

-- yacht_bookings policies
CREATE POLICY "Users can view bookings for their yacht or staff can view all"
  ON yacht_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = yacht_bookings.yacht_id
    )
    OR is_staff()
  );

CREATE POLICY "Authenticated users can delete bookings"
  ON yacht_bookings FOR DELETE
  TO authenticated
  USING (is_staff());

-- repair_requests policies
CREATE POLICY "Authenticated users can view repair requests"
  ON repair_requests FOR SELECT
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Authenticated users can update repair requests"
  ON repair_requests FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Staff can delete maintenance requests"
  ON repair_requests FOR DELETE
  TO authenticated
  USING (is_staff());

-- owner_chat_messages policies
CREATE POLICY "Authenticated users can insert chat messages"
  ON owner_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_staff()
  );

CREATE POLICY "Authenticated users can view chat messages"
  ON owner_chat_messages FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

-- trip_inspections policies
CREATE POLICY "Authenticated users can view trip inspections"
  ON trip_inspections FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Staff and managers can insert inspections"
  ON trip_inspections FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can update inspections"
  ON trip_inspections FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- owner_handoff_inspections policies
CREATE POLICY "Authenticated users can view handoff inspections"
  ON owner_handoff_inspections FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Staff can insert owner handoff inspections"
  ON owner_handoff_inspections FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update owner handoff inspections"
  ON owner_handoff_inspections FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- yacht_documents policies
CREATE POLICY "Staff and managers can insert yacht documents"
  ON yacht_documents FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can update yacht documents"
  ON yacht_documents FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can delete yacht documents"
  ON yacht_documents FOR DELETE
  TO authenticated
  USING (is_staff());

-- admin_notifications policies
CREATE POLICY "Staff can update admin notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- appointments policies
CREATE POLICY "Staff can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can view all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (is_staff());

-- staff_messages policies
CREATE POLICY "Staff and managers can view all staff messages"
  ON staff_messages FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can update staff messages"
  ON staff_messages FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete staff messages"
  ON staff_messages FOR DELETE
  TO authenticated
  USING (is_staff());

-- yacht_invoices policies
CREATE POLICY "Authenticated users can view invoices"
  ON yacht_invoices FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Staff can insert invoices"
  ON yacht_invoices FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update invoices"
  ON yacht_invoices FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete invoices"
  ON yacht_invoices FOR DELETE
  TO authenticated
  USING (is_staff());

-- yacht_budgets policies
CREATE POLICY "Authenticated users can view yacht budgets"
  ON yacht_budgets FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Authenticated users can insert yacht budgets"
  ON yacht_budgets FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Authenticated users can update yacht budgets"
  ON yacht_budgets FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete budgets"
  ON yacht_budgets FOR DELETE
  TO authenticated
  USING (is_staff());

-- yacht_smart_devices policies
CREATE POLICY "Authenticated users can view smart devices"
  ON yacht_smart_devices FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Staff can insert devices"
  ON yacht_smart_devices FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update devices"
  ON yacht_smart_devices FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete devices"
  ON yacht_smart_devices FOR DELETE
  TO authenticated
  USING (is_staff());

-- tuya_device_credentials policies
CREATE POLICY "Staff can view credentials"
  ON tuya_device_credentials FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert credentials"
  ON tuya_device_credentials FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update credentials"
  ON tuya_device_credentials FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete credentials"
  ON tuya_device_credentials FOR DELETE
  TO authenticated
  USING (is_staff());

-- smart_lock_access_logs policies
CREATE POLICY "Authenticated users can view access logs"
  ON smart_lock_access_logs FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM yacht_smart_devices
      WHERE yacht_id IN (
        SELECT yacht_id FROM user_profiles
        WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
      )
    )
    OR is_staff()
  );

-- smart_lock_command_logs policies
CREATE POLICY "Authenticated users can view command logs"
  ON smart_lock_command_logs FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM yacht_smart_devices
      WHERE yacht_id IN (
        SELECT yacht_id FROM user_profiles
        WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
      )
    )
    OR is_staff()
  );

-- education_videos policies (staff only)
CREATE POLICY "Only staff can insert education videos"
  ON education_videos FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Only staff can update education videos"
  ON education_videos FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Only staff can delete education videos"
  ON education_videos FOR DELETE
  TO authenticated
  USING (is_staff());

-- video_uploads policies
CREATE POLICY "Authenticated users can view video uploads"
  ON video_uploads FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert video uploads"
  ON video_uploads FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update video upload status"
  ON video_uploads FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- invoice_engagement_events policies
CREATE POLICY "Staff can view all engagement events"
  ON invoice_engagement_events FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert engagement events"
  ON invoice_engagement_events FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

-- vessel_management_agreements policies
CREATE POLICY "Authenticated users can update vessel agreements"
  ON vessel_management_agreements FOR UPDATE
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  )
  WITH CHECK (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );
