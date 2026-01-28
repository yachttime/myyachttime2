/*
  # Fix Security and Performance Issues - Part 3: RLS Policies

  ## Performance Improvements
  
  Wrap all `auth.uid()` calls with `(select auth.uid())` to prevent re-evaluation per row.
  This caches the auth function result and improves query performance at scale.
  
  ## Security Improvements
  
  Fix policies that use `true` conditions to have proper security checks.
*/

-- ============================================================================
-- USER_PROFILES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can view all profiles" ON public.user_profiles;
CREATE POLICY "Staff can view all profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (is_staff((select auth.uid())));

DROP POLICY IF EXISTS "Staff can update any profile" ON public.user_profiles;
CREATE POLICY "Staff can update any profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (is_staff((select auth.uid())));

-- ============================================================================
-- MAINTENANCE_REQUESTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view maintenance requests for their yacht" ON public.maintenance_requests;
CREATE POLICY "Users can view maintenance requests for their yacht"
  ON public.maintenance_requests FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id) AND (select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Users can update own maintenance requests"
  ON public.maintenance_requests FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- YACHT_BOOKINGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view bookings for their yacht or staff can view all" ON public.yacht_bookings;
CREATE POLICY "Users can view bookings for their yacht or staff can view all"
  ON public.yacht_bookings FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id) OR is_staff());

DROP POLICY IF EXISTS "Users can update own bookings" ON public.yacht_bookings;
CREATE POLICY "Users can update own bookings"
  ON public.yacht_bookings FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own bookings" ON public.yacht_bookings;
CREATE POLICY "Users can delete own bookings"
  ON public.yacht_bookings FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- EDUCATION_VIDEOS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Only staff can insert education videos" ON public.education_videos;
CREATE POLICY "Only staff can insert education videos"
  ON public.education_videos FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Only staff can update education videos" ON public.education_videos;
CREATE POLICY "Only staff can update education videos"
  ON public.education_videos FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Only staff can delete education videos" ON public.education_videos;
CREATE POLICY "Only staff can delete education videos"
  ON public.education_videos FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- OWNER_HANDOFF_INSPECTIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view their yacht handoff inspections" ON public.owner_handoff_inspections;
CREATE POLICY "Owners can view their yacht handoff inspections"
  ON public.owner_handoff_inspections FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

DROP POLICY IF EXISTS "Staff can view all owner handoff inspections" ON public.owner_handoff_inspections;
CREATE POLICY "Staff can view all owner handoff inspections"
  ON public.owner_handoff_inspections FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can insert owner handoff inspections" ON public.owner_handoff_inspections;
CREATE POLICY "Staff can insert owner handoff inspections"
  ON public.owner_handoff_inspections FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Staff can update owner handoff inspections" ON public.owner_handoff_inspections;
CREATE POLICY "Staff can update owner handoff inspections"
  ON public.owner_handoff_inspections FOR UPDATE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- ADMIN_NOTIFICATIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.admin_notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Staff can update admin notifications" ON public.admin_notifications;
CREATE POLICY "Staff can update admin notifications"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- YACHT_HISTORY_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert yacht history logs" ON public.yacht_history_logs;
CREATE POLICY "Authenticated users can insert yacht history logs"
  ON public.yacht_history_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- YACHT_INVOICES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Staff can view all invoices" ON public.yacht_invoices;
CREATE POLICY "Staff can view all invoices"
  ON public.yacht_invoices FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Managers can view own yacht invoices" ON public.yacht_invoices;
CREATE POLICY "Managers can view own yacht invoices"
  ON public.yacht_invoices FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Staff can insert invoices" ON public.yacht_invoices;
CREATE POLICY "Staff can insert invoices"
  ON public.yacht_invoices FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Staff can update invoices" ON public.yacht_invoices;
CREATE POLICY "Staff can update invoices"
  ON public.yacht_invoices FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can delete invoices" ON public.yacht_invoices;
CREATE POLICY "Staff can delete invoices"
  ON public.yacht_invoices FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- YACHTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible yachts" ON public.yachts;
CREATE POLICY "Users can view accessible yachts"
  ON public.yachts FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(id));

DROP POLICY IF EXISTS "Staff can insert yachts" ON public.yachts;
CREATE POLICY "Staff can insert yachts"
  ON public.yachts FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Staff can update yachts" ON public.yachts;
CREATE POLICY "Staff can update yachts"
  ON public.yachts FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can delete yachts" ON public.yachts;
CREATE POLICY "Staff can delete yachts"
  ON public.yachts FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- REPAIR_REQUESTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own repair requests" ON public.repair_requests;
CREATE POLICY "Users can view own repair requests"
  ON public.repair_requests FOR SELECT
  TO authenticated
  USING (submitted_by = (select auth.uid()));

DROP POLICY IF EXISTS "Owners can view repair requests for their yacht" ON public.repair_requests;
CREATE POLICY "Owners can view repair requests for their yacht"
  ON public.repair_requests FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "Managers can view all repair requests for their yacht" ON public.repair_requests;
CREATE POLICY "Managers can view all repair requests for their yacht"
  ON public.repair_requests FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Staff can view all repair requests" ON public.repair_requests;
CREATE POLICY "Staff can view all repair requests"
  ON public.repair_requests FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can view retail customer repair requests" ON public.repair_requests;
CREATE POLICY "Staff can view retail customer repair requests"
  ON public.repair_requests FOR SELECT
  TO authenticated
  USING (is_staff() AND is_retail_customer = true);

DROP POLICY IF EXISTS "Users can create repair requests" ON public.repair_requests;
CREATE POLICY "Users can create repair requests"
  ON public.repair_requests FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own pending repair requests" ON public.repair_requests;
CREATE POLICY "Users can update own pending repair requests"
  ON public.repair_requests FOR UPDATE
  TO authenticated
  USING (submitted_by = (select auth.uid()) AND status = 'pending');

DROP POLICY IF EXISTS "Staff can update repair requests" ON public.repair_requests;
CREATE POLICY "Staff can update repair requests"
  ON public.repair_requests FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can update retail customer repair requests" ON public.repair_requests;
CREATE POLICY "Staff can update retail customer repair requests"
  ON public.repair_requests FOR UPDATE
  TO authenticated
  USING (is_staff() AND is_retail_customer = true);

DROP POLICY IF EXISTS "Managers can update repair requests for their yacht" ON public.repair_requests;
CREATE POLICY "Managers can update repair requests for their yacht"
  ON public.repair_requests FOR UPDATE
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

-- ============================================================================
-- TRIP_INSPECTIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view inspections for their yacht" ON public.trip_inspections;
CREATE POLICY "Users can view inspections for their yacht"
  ON public.trip_inspections FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

DROP POLICY IF EXISTS "Staff can view all inspections" ON public.trip_inspections;
CREATE POLICY "Staff can view all inspections"
  ON public.trip_inspections FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Managers can view all inspections" ON public.trip_inspections;
CREATE POLICY "Managers can view all inspections"
  ON public.trip_inspections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Staff and managers can insert inspections" ON public.trip_inspections;
CREATE POLICY "Staff and managers can insert inspections"
  ON public.trip_inspections FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff() OR 
    EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager')
  );

DROP POLICY IF EXISTS "Staff and managers can update inspections" ON public.trip_inspections;
CREATE POLICY "Staff and managers can update inspections"
  ON public.trip_inspections FOR UPDATE
  TO authenticated
  USING (
    is_staff() OR 
    EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager')
  );

-- ============================================================================
-- OWNER_CHAT_MESSAGES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view messages for their assigned yacht" ON public.owner_chat_messages;
CREATE POLICY "Owners can view messages for their assigned yacht"
  ON public.owner_chat_messages FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff and managers can view all messages" ON public.owner_chat_messages;
CREATE POLICY "Staff and managers can view all messages"
  ON public.owner_chat_messages FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Owners can create messages for their yacht" ON public.owner_chat_messages;
CREATE POLICY "Owners can create messages for their yacht"
  ON public.owner_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff and managers can create messages for any yacht" ON public.owner_chat_messages;
CREATE POLICY "Staff and managers can create messages for any yacht"
  ON public.owner_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

-- ============================================================================
-- YACHT_DOCUMENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Staff and managers can insert yacht documents" ON public.yacht_documents;
CREATE POLICY "Staff and managers can insert yacht documents"
  ON public.yacht_documents FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Staff and managers can update yacht documents" ON public.yacht_documents;
CREATE POLICY "Staff and managers can update yacht documents"
  ON public.yacht_documents FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff and managers can delete yacht documents" ON public.yacht_documents;
CREATE POLICY "Staff and managers can delete yacht documents"
  ON public.yacht_documents FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- APPOINTMENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Staff can create appointments" ON public.appointments;
CREATE POLICY "Staff can create appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Staff and managers can view all appointments" ON public.appointments;
CREATE POLICY "Staff and managers can view all appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can delete appointments" ON public.appointments;
CREATE POLICY "Staff can delete appointments"
  ON public.appointments FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- STAFF_MESSAGES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create staff messages" ON public.staff_messages;
CREATE POLICY "Authenticated users can create staff messages"
  ON public.staff_messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Staff and managers can view all staff messages" ON public.staff_messages;
CREATE POLICY "Staff and managers can view all staff messages"
  ON public.staff_messages FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can update staff messages" ON public.staff_messages;
CREATE POLICY "Staff can update staff messages"
  ON public.staff_messages FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can delete staff messages" ON public.staff_messages;
CREATE POLICY "Staff can delete staff messages"
  ON public.staff_messages FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- SMART_LOCK_COMMAND_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "System can insert command logs" ON public.smart_lock_command_logs;
CREATE POLICY "System can insert command logs"
  ON public.smart_lock_command_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Owners can view logs for their yacht" ON public.smart_lock_command_logs;
CREATE POLICY "Owners can view logs for their yacht"
  ON public.smart_lock_command_logs FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

DROP POLICY IF EXISTS "Staff can view all command logs" ON public.smart_lock_command_logs;
CREATE POLICY "Staff can view all command logs"
  ON public.smart_lock_command_logs FOR SELECT
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- YACHT_BUDGETS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Staff can view all budgets" ON public.yacht_budgets;
CREATE POLICY "Staff can view all budgets"
  ON public.yacht_budgets FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Managers can view own yacht budget" ON public.yacht_budgets;
CREATE POLICY "Managers can view own yacht budget"
  ON public.yacht_budgets FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Staff can insert all budgets" ON public.yacht_budgets;
CREATE POLICY "Staff can insert all budgets"
  ON public.yacht_budgets FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "Managers can insert own yacht budget" ON public.yacht_budgets;
CREATE POLICY "Managers can insert own yacht budget"
  ON public.yacht_budgets FOR INSERT
  TO authenticated
  WITH CHECK (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Staff can update all budgets" ON public.yacht_budgets;
CREATE POLICY "Staff can update all budgets"
  ON public.yacht_budgets FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Managers can update own yacht budget" ON public.yacht_budgets;
CREATE POLICY "Managers can update own yacht budget"
  ON public.yacht_budgets FOR UPDATE
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles WHERE id = (select auth.uid()) AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Staff can delete budgets" ON public.yacht_budgets;
CREATE POLICY "Staff can delete budgets"
  ON public.yacht_budgets FOR DELETE
  TO authenticated
  USING (is_staff());

-- ============================================================================
-- YACHT_SMART_DEVICES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view devices for their yacht" ON public.yacht_smart_devices;
CREATE POLICY "Owners can view devices for their yacht"
  ON public.yacht_smart_devices FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

-- ============================================================================
-- SMART_LOCK_ACCESS_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view logs for their yacht" ON public.smart_lock_access_logs;
CREATE POLICY "Owners can view logs for their yacht"
  ON public.smart_lock_access_logs FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

DROP POLICY IF EXISTS "Users can insert their own logs" ON public.smart_lock_access_logs;
CREATE POLICY "Users can insert their own logs"
  ON public.smart_lock_access_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- VESSEL_MANAGEMENT_AGREEMENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view vessel agreements for their yacht" ON public.vessel_management_agreements;
CREATE POLICY "Users can view vessel agreements for their yacht"
  ON public.vessel_management_agreements FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

DROP POLICY IF EXISTS "Users can insert vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Users can insert vessel agreements"
  ON public.vessel_management_agreements FOR INSERT
  TO authenticated
  WITH CHECK (user_has_yacht_access(yacht_id));

DROP POLICY IF EXISTS "Owners can update their own draft vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Owners can update their own draft vessel agreements"
  ON public.vessel_management_agreements FOR UPDATE
  TO authenticated
  USING (
    submitted_by = (select auth.uid()) AND status = 'draft'
  );

DROP POLICY IF EXISTS "Owners can update their own rejected vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Owners can update their own rejected vessel agreements"
  ON public.vessel_management_agreements FOR UPDATE
  TO authenticated
  USING (
    submitted_by = (select auth.uid()) AND status = 'rejected'
  );

DROP POLICY IF EXISTS "Staff and managers can update vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Staff and managers can update vessel agreements"
  ON public.vessel_management_agreements FOR UPDATE
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "Owners can delete their own draft vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Owners can delete their own draft vessel agreements"
  ON public.vessel_management_agreements FOR DELETE
  TO authenticated
  USING (
    submitted_by = (select auth.uid()) AND status = 'draft'
  );
