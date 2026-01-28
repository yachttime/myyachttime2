/*
  # Consolidate Remaining Duplicate RLS Policies
  
  1. Security Enhancement
    - Remove duplicate permissive policies that create security warnings
    - Multiple permissive policies are OR'd together which can be unclear
    - Consolidate into single policies with clear OR conditions
    
  2. Tables Updated
    - owner_chat_messages (INSERT, SELECT)
    - repair_requests (SELECT, UPDATE)
    - user_profiles (SELECT, UPDATE)
    - vessel_management_agreements (UPDATE)
    - yacht_budgets (INSERT, SELECT, UPDATE)
    
  3. Important Notes
    - Same access patterns maintained
    - Better security clarity
    - Improved query performance
*/

-- ============================================================================
-- OWNER_CHAT_MESSAGES - Consolidate duplicate policies
-- ============================================================================

-- Remove old duplicate INSERT policies
DROP POLICY IF EXISTS "Owners can create messages for their yacht" ON public.owner_chat_messages;
DROP POLICY IF EXISTS "Staff and managers can create messages for any yacht" ON public.owner_chat_messages;

-- Create single consolidated INSERT policy
CREATE POLICY "Authenticated users can insert chat messages"
  ON public.owner_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- Remove old duplicate SELECT policies
DROP POLICY IF EXISTS "Owners can view messages for their assigned yacht" ON public.owner_chat_messages;
DROP POLICY IF EXISTS "Staff and managers can view all messages" ON public.owner_chat_messages;

-- Create single consolidated SELECT policy
CREATE POLICY "Authenticated users can view chat messages"
  ON public.owner_chat_messages FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- ============================================================================
-- REPAIR_REQUESTS - Consolidate duplicate SELECT policies
-- ============================================================================

-- Remove old duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view own repair requests" ON public.repair_requests;
DROP POLICY IF EXISTS "Owners can view repair requests for their yacht" ON public.repair_requests;
DROP POLICY IF EXISTS "Managers can view all repair requests for their yacht" ON public.repair_requests;
DROP POLICY IF EXISTS "Staff can view all repair requests" ON public.repair_requests;
DROP POLICY IF EXISTS "Staff can view retail customer repair requests" ON public.repair_requests;

-- Create single consolidated SELECT policy
CREATE POLICY "Authenticated users can view repair requests"
  ON public.repair_requests FOR SELECT
  TO authenticated
  USING (
    submitted_by = (select auth.uid())
    OR (yacht_id IS NOT NULL AND user_has_yacht_access(yacht_id))
    OR is_staff()
  );

-- Remove old duplicate UPDATE policies
DROP POLICY IF EXISTS "Users can update own pending repair requests" ON public.repair_requests;
DROP POLICY IF EXISTS "Managers can update repair requests for their yacht" ON public.repair_requests;
DROP POLICY IF EXISTS "Staff can update repair requests" ON public.repair_requests;
DROP POLICY IF EXISTS "Staff can update retail customer repair requests" ON public.repair_requests;

-- Create single consolidated UPDATE policy
CREATE POLICY "Authenticated users can update repair requests"
  ON public.repair_requests FOR UPDATE
  TO authenticated
  USING (
    (submitted_by = (select auth.uid()) AND status = 'pending')
    OR is_staff()
  );

-- ============================================================================
-- USER_PROFILES - Consolidate duplicate SELECT policies
-- ============================================================================

-- Remove old duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff and managers can view all user profiles" ON public.user_profiles;

-- Create single consolidated SELECT policy
CREATE POLICY "Authenticated users can view user profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid()) OR is_staff()
  );

-- Remove old duplicate UPDATE policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff can update any profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff and managers can update user profiles" ON public.user_profiles;

-- Create single consolidated UPDATE policy
CREATE POLICY "Authenticated users can update user profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (
    id = (select auth.uid()) OR is_staff()
  )
  WITH CHECK (
    id = (select auth.uid()) OR is_staff()
  );

-- ============================================================================
-- VESSEL_MANAGEMENT_AGREEMENTS - Consolidate duplicate UPDATE policies
-- ============================================================================

-- Remove old duplicate UPDATE policies
DROP POLICY IF EXISTS "Owners can update their own draft vessel agreements" ON public.vessel_management_agreements;
DROP POLICY IF EXISTS "Owners can update their own rejected vessel agreements" ON public.vessel_management_agreements;
DROP POLICY IF EXISTS "Staff and managers can update vessel agreements" ON public.vessel_management_agreements;

-- Create single consolidated UPDATE policy
CREATE POLICY "Authenticated users can update vessel agreements"
  ON public.vessel_management_agreements FOR UPDATE
  TO authenticated
  USING (
    (submitted_by = (select auth.uid()) AND status IN ('draft', 'rejected'))
    OR is_staff()
  )
  WITH CHECK (
    (submitted_by = (select auth.uid()) AND status IN ('draft', 'rejected'))
    OR is_staff()
  );

-- ============================================================================
-- YACHT_BUDGETS - Consolidate duplicate INSERT policies
-- ============================================================================

-- Remove old duplicate INSERT policies
DROP POLICY IF EXISTS "Managers can insert own yacht budget" ON public.yacht_budgets;
DROP POLICY IF EXISTS "Staff can insert all budgets" ON public.yacht_budgets;

-- Create single consolidated INSERT policy
CREATE POLICY "Authenticated users can insert yacht budgets"
  ON public.yacht_budgets FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff()
  );

-- Remove old duplicate SELECT policies
DROP POLICY IF EXISTS "Managers can view own yacht budget" ON public.yacht_budgets;
DROP POLICY IF EXISTS "Staff can view all budgets" ON public.yacht_budgets;

-- Create single consolidated SELECT policy
CREATE POLICY "Authenticated users can view yacht budgets"
  ON public.yacht_budgets FOR SELECT
  TO authenticated
  USING (
    user_has_yacht_access(yacht_id) OR is_staff()
  );

-- Remove old duplicate UPDATE policies
DROP POLICY IF EXISTS "Managers can update own yacht budget" ON public.yacht_budgets;
DROP POLICY IF EXISTS "Staff can update all budgets" ON public.yacht_budgets;

-- Create single consolidated UPDATE policy
CREATE POLICY "Authenticated users can update yacht budgets"
  ON public.yacht_budgets FOR UPDATE
  TO authenticated
  USING (
    is_staff()
  )
  WITH CHECK (
    is_staff()
  );
