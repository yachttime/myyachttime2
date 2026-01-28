/*
  # Drop All RLS Policies and Recreate Without Admin Role

  1. Problem
    - Previous migration didn't properly drop old policies
    - Old policies still referencing 'admin' role are causing all queries to fail
  
  2. Solution
    - Drop ALL existing RLS policies
    - Recreate all policies without any 'admin' role references
    - Only use valid roles: staff, manager, mechanic, owner
  
  3. Impact
    - All database queries will work correctly
    - Clean slate for RLS policies
*/

-- Drop ALL existing policies on all tables
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- USER PROFILES policies
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own profile and staff can view all"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_staff());

CREATE POLICY "Users can update own profile and staff can update all"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_staff())
  WITH CHECK (user_id = auth.uid() OR is_staff());

-- YACHTS policies
CREATE POLICY "Users can view yachts they have access to"
  ON yachts FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

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

CREATE POLICY "Allow anonymous users to read yacht names for signup"
  ON yachts FOR SELECT
  TO anon
  USING (true);

-- YACHT BOOKINGS policies
CREATE POLICY "Users can view bookings for their yacht or staff can view all"
  ON yacht_bookings FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Authenticated users can insert bookings"
  ON yacht_bookings FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Authenticated users can update bookings"
  ON yacht_bookings FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Authenticated users can delete bookings"
  ON yacht_bookings FOR DELETE
  TO authenticated
  USING (is_staff());

-- REPAIR REQUESTS policies
CREATE POLICY "Authenticated users can insert repair requests"
  ON repair_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

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

-- OWNER CHAT MESSAGES policies
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
    user_id = auth.uid()
    OR yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

-- ADMIN NOTIFICATIONS policies
CREATE POLICY "Authenticated users can view admin notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert admin notifications"
  ON admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update admin notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete admin notifications"
  ON admin_notifications FOR DELETE
  TO authenticated
  USING (is_staff());

-- TRIP INSPECTIONS policies
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

CREATE POLICY "Staff can delete trip inspections"
  ON trip_inspections FOR DELETE
  TO authenticated
  USING (is_staff());

-- YACHT HISTORY LOGS policies
CREATE POLICY "Authenticated users can view yacht history"
  ON yacht_history_logs FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "System can insert yacht history logs"
  ON yacht_history_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- OWNER HANDOFF INSPECTIONS policies
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

CREATE POLICY "Staff can delete owner handoff inspections"
  ON owner_handoff_inspections FOR DELETE
  TO authenticated
  USING (is_staff());

-- YACHT DOCUMENTS policies
CREATE POLICY "Authenticated users can view yacht documents"
  ON yacht_documents FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

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

-- APPOINTMENTS policies
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

-- STAFF MESSAGES policies
CREATE POLICY "Staff and managers can view all staff messages"
  ON staff_messages FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert staff messages"
  ON staff_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update staff messages"
  ON staff_messages FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete staff messages"
  ON staff_messages FOR DELETE
  TO authenticated
  USING (is_staff());

-- YACHT INVOICES policies
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

-- YACHT BUDGETS policies
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

-- YACHT SMART DEVICES policies
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

-- TUYA DEVICE CREDENTIALS policies
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

-- SMART LOCK ACCESS LOGS policies
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

CREATE POLICY "System can insert access logs"
  ON smart_lock_access_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SMART LOCK COMMAND LOGS policies
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

CREATE POLICY "System can insert command logs"
  ON smart_lock_command_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- EDUCATION VIDEOS policies
CREATE POLICY "Authenticated users can view education videos"
  ON education_videos FOR SELECT
  TO authenticated
  USING (true);

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

-- VIDEO UPLOADS policies
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

-- INVOICE ENGAGEMENT EVENTS policies
CREATE POLICY "Staff can view all engagement events"
  ON invoice_engagement_events FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert engagement events"
  ON invoice_engagement_events FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

-- VESSEL MANAGEMENT AGREEMENTS policies
CREATE POLICY "Authenticated users can view vessel agreements"
  ON vessel_management_agreements FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_id = auth.uid() AND yacht_id IS NOT NULL
    )
    OR is_staff()
  );

CREATE POLICY "Staff can insert vessel agreements"
  ON vessel_management_agreements FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

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
