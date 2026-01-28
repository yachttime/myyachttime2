/*
  # Security and Performance Fixes - Part 2: RLS Policy Optimization

  1. Performance Improvements
    - Optimize RLS policies to use `(SELECT auth.uid())` pattern instead of direct auth.uid() calls
    - This prevents re-evaluation of auth functions for each row

  2. Security Fixes
    - Fix unrestricted INSERT policies that allow any authenticated user
    - Add proper access controls

  3. Tables Modified
    - user_profiles
    - yacht_bookings
    - yachts
    - trip_inspections
    - repair_requests
    - owner_chat_messages
    - yacht_history_logs
    - owner_handoff_inspections
    - yacht_documents
    - yacht_invoices
    - yacht_budgets
    - yacht_smart_devices
    - smart_lock_access_logs
    - smart_lock_command_logs
    - vessel_management_agreements
*/

-- =====================================================
-- user_profiles table
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile and staff can update all" ON public.user_profiles;
CREATE POLICY "Users can update own profile and staff can update all"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    is_staff((SELECT auth.uid()))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view own profile and staff can view all" ON public.user_profiles;
CREATE POLICY "Users can view own profile and staff can view all"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- yachts table
-- =====================================================

DROP POLICY IF EXISTS "Users can view yachts they have access to" ON public.yachts;
CREATE POLICY "Users can view yachts they have access to"
  ON public.yachts
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can update yachts" ON public.yachts;
CREATE POLICY "Staff can update yachts"
  ON public.yachts
  FOR UPDATE
  TO authenticated
  USING (is_staff((SELECT auth.uid())))
  WITH CHECK (is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Staff can insert yachts" ON public.yachts;
CREATE POLICY "Staff can insert yachts"
  ON public.yachts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Staff can delete yachts" ON public.yachts;
CREATE POLICY "Staff can delete yachts"
  ON public.yachts
  FOR DELETE
  TO authenticated
  USING (is_staff((SELECT auth.uid())));

-- =====================================================
-- yacht_bookings table
-- =====================================================

DROP POLICY IF EXISTS "Users can view bookings for their yacht or staff can view all" ON public.yacht_bookings;
CREATE POLICY "Users can view bookings for their yacht or staff can view all"
  ON public.yacht_bookings
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can update bookings" ON public.yacht_bookings;
CREATE POLICY "Authenticated users can update bookings"
  ON public.yacht_bookings
  FOR UPDATE
  TO authenticated
  USING (is_staff((SELECT auth.uid())))
  WITH CHECK (is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON public.yacht_bookings;
CREATE POLICY "Authenticated users can insert bookings"
  ON public.yacht_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON public.yacht_bookings;
CREATE POLICY "Authenticated users can delete bookings"
  ON public.yacht_bookings
  FOR DELETE
  TO authenticated
  USING (is_staff((SELECT auth.uid())));

-- =====================================================
-- trip_inspections table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view trip inspections" ON public.trip_inspections;
CREATE POLICY "Authenticated users can view trip inspections"
  ON public.trip_inspections
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- repair_requests table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view repair requests" ON public.repair_requests;
CREATE POLICY "Authenticated users can view repair requests"
  ON public.repair_requests
  FOR SELECT
  TO authenticated
  USING (
    submitted_by = (SELECT auth.uid()) OR
    (yacht_id IS NOT NULL AND yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    )) OR
    is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can update repair requests" ON public.repair_requests;
CREATE POLICY "Authenticated users can update repair requests"
  ON public.repair_requests
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = (SELECT auth.uid()) OR
    (yacht_id IS NOT NULL AND yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    )) OR
    is_staff((SELECT auth.uid()))
  )
  WITH CHECK (
    submitted_by = (SELECT auth.uid()) OR
    (yacht_id IS NOT NULL AND yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    )) OR
    is_staff((SELECT auth.uid()))
  );

-- Fix the unrestricted INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert repair requests" ON public.repair_requests;
CREATE POLICY "Authenticated users can insert repair requests"
  ON public.repair_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
  );

-- =====================================================
-- owner_chat_messages table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view chat messages" ON public.owner_chat_messages;
CREATE POLICY "Authenticated users can view chat messages"
  ON public.owner_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IS NULL OR
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.owner_chat_messages;
CREATE POLICY "Authenticated users can insert chat messages"
  ON public.owner_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    (yacht_id IS NULL OR
     yacht_id IN (
       SELECT user_profiles.yacht_id
       FROM user_profiles
       WHERE user_profiles.user_id = (SELECT auth.uid())
         AND user_profiles.yacht_id IS NOT NULL
     ) OR
     is_staff((SELECT auth.uid())))
  );

-- =====================================================
-- yacht_history_logs table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view yacht history" ON public.yacht_history_logs;
CREATE POLICY "Authenticated users can view yacht history"
  ON public.yacht_history_logs
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- Fix the unrestricted INSERT policy
DROP POLICY IF EXISTS "System can insert yacht history logs" ON public.yacht_history_logs;
CREATE POLICY "System can insert yacht history logs"
  ON public.yacht_history_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- owner_handoff_inspections table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view handoff inspections" ON public.owner_handoff_inspections;
CREATE POLICY "Authenticated users can view handoff inspections"
  ON public.owner_handoff_inspections
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- yacht_documents table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view yacht documents" ON public.yacht_documents;
CREATE POLICY "Authenticated users can view yacht documents"
  ON public.yacht_documents
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- yacht_invoices table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.yacht_invoices;
CREATE POLICY "Authenticated users can view invoices"
  ON public.yacht_invoices
  FOR SELECT
  TO authenticated
  USING (
    (yacht_id IS NOT NULL AND yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    )) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- yacht_budgets table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view yacht budgets" ON public.yacht_budgets;
CREATE POLICY "Authenticated users can view yacht budgets"
  ON public.yacht_budgets
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- yacht_smart_devices table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view smart devices" ON public.yacht_smart_devices;
CREATE POLICY "Authenticated users can view smart devices"
  ON public.yacht_smart_devices
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- smart_lock_access_logs table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view access logs" ON public.smart_lock_access_logs;
CREATE POLICY "Authenticated users can view access logs"
  ON public.smart_lock_access_logs
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- Fix the unrestricted INSERT policy
DROP POLICY IF EXISTS "System can insert access logs" ON public.smart_lock_access_logs;
CREATE POLICY "System can insert access logs"
  ON public.smart_lock_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- smart_lock_command_logs table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view command logs" ON public.smart_lock_command_logs;
CREATE POLICY "Authenticated users can view command logs"
  ON public.smart_lock_command_logs
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT yacht_smart_devices.id
      FROM yacht_smart_devices
      WHERE yacht_smart_devices.yacht_id IN (
        SELECT user_profiles.yacht_id
        FROM user_profiles
        WHERE user_profiles.user_id = (SELECT auth.uid())
          AND user_profiles.yacht_id IS NOT NULL
      )
    ) OR
    is_staff((SELECT auth.uid()))
  );

-- Fix the unrestricted INSERT policy - restrict to staff only since no user_id column
DROP POLICY IF EXISTS "System can insert command logs" ON public.smart_lock_command_logs;
CREATE POLICY "System can insert command logs"
  ON public.smart_lock_command_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff((SELECT auth.uid()))
  );

-- =====================================================
-- vessel_management_agreements table
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Authenticated users can view vessel agreements"
  ON public.vessel_management_agreements
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can update vessel agreements" ON public.vessel_management_agreements;
CREATE POLICY "Authenticated users can update vessel agreements"
  ON public.vessel_management_agreements
  FOR UPDATE
  TO authenticated
  USING (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  )
  WITH CHECK (
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );