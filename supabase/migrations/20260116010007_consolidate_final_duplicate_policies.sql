/*
  # Consolidate Final Duplicate RLS Policies
  
  1. Security Enhancement
    - Remove remaining duplicate permissive policies
    - Consolidate into single policies per table/action
    
  2. Tables Updated
    - owner_handoff_inspections (SELECT)
    - smart_lock_access_logs (SELECT)
    - smart_lock_command_logs (SELECT)
    - trip_inspections (SELECT)
    - video_uploads (SELECT)
    - yacht_bookings (DELETE)
    - yacht_invoices (SELECT)
    - yacht_smart_devices (SELECT)
    
  3. Important Notes
    - Same access patterns maintained
    - Better security clarity
    - Improved query performance
*/

-- ============================================================================
-- OWNER_HANDOFF_INSPECTIONS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view their yacht handoff inspections" ON public.owner_handoff_inspections;
DROP POLICY IF EXISTS "Staff can view all owner handoff inspections" ON public.owner_handoff_inspections;

CREATE POLICY "Authenticated users can view handoff inspections"
  ON public.owner_handoff_inspections FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- ============================================================================
-- SMART_LOCK_ACCESS_LOGS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view logs for their yacht" ON public.smart_lock_access_logs;
DROP POLICY IF EXISTS "Staff can view all logs" ON public.smart_lock_access_logs;

CREATE POLICY "Authenticated users can view access logs"
  ON public.smart_lock_access_logs FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- ============================================================================
-- SMART_LOCK_COMMAND_LOGS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view logs for their yacht" ON public.smart_lock_command_logs;
DROP POLICY IF EXISTS "Staff can view all command logs" ON public.smart_lock_command_logs;

CREATE POLICY "Authenticated users can view command logs"
  ON public.smart_lock_command_logs FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- ============================================================================
-- TRIP_INSPECTIONS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view inspections for their yacht" ON public.trip_inspections;
DROP POLICY IF EXISTS "Staff can view all inspections" ON public.trip_inspections;
DROP POLICY IF EXISTS "Managers can view all inspections" ON public.trip_inspections;

CREATE POLICY "Authenticated users can view trip inspections"
  ON public.trip_inspections FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- ============================================================================
-- VIDEO_UPLOADS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view videos for their yacht" ON public.video_uploads;
DROP POLICY IF EXISTS "Staff can view all video uploads" ON public.video_uploads;

CREATE POLICY "Authenticated users can view video uploads"
  ON public.video_uploads FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- ============================================================================
-- YACHT_BOOKINGS - Consolidate duplicate DELETE policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete own bookings" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Staff can delete any booking" ON public.yacht_bookings;

CREATE POLICY "Authenticated users can delete bookings"
  ON public.yacht_bookings FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR is_staff()
  );

-- ============================================================================
-- YACHT_INVOICES - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Staff can view all invoices" ON public.yacht_invoices;
DROP POLICY IF EXISTS "Managers can view own yacht invoices" ON public.yacht_invoices;

CREATE POLICY "Authenticated users can view invoices"
  ON public.yacht_invoices FOR SELECT
  TO authenticated
  USING (
    (yacht_id IS NOT NULL AND user_has_yacht_access(yacht_id)) OR is_staff()
  );

-- ============================================================================
-- YACHT_SMART_DEVICES - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Owners can view devices for their yacht" ON public.yacht_smart_devices;
DROP POLICY IF EXISTS "Staff can view all devices" ON public.yacht_smart_devices;

CREATE POLICY "Authenticated users can view smart devices"
  ON public.yacht_smart_devices FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );
