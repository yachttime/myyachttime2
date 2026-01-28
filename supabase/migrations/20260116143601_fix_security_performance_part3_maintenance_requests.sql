/*
  # Security Fixes - Part 3: Add Missing RLS Policies for maintenance_requests

  1. Security Improvements
    - Add complete set of RLS policies for maintenance_requests table
    - Table currently has RLS enabled but no policies (security vulnerability)

  2. Policies Added
    - SELECT: Users can view their own requests, yacht owners can view their yacht's requests, staff can view all
    - INSERT: Users can create requests with their own user_id
    - UPDATE: Users can update own requests, yacht owners can update their yacht's requests, staff can update all
    - DELETE: Staff only

  3. Performance
    - Uses optimized (SELECT auth.uid()) pattern for better performance
*/

-- maintenance_requests table policies
DROP POLICY IF EXISTS "Authenticated users can view maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Authenticated users can view maintenance requests"
  ON public.maintenance_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can insert maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Authenticated users can insert maintenance requests"
  ON public.maintenance_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can update maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Authenticated users can update maintenance requests"
  ON public.maintenance_requests
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    yacht_id IN (
      SELECT user_profiles.yacht_id
      FROM user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.yacht_id IS NOT NULL
    ) OR
    is_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can delete maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Staff can delete maintenance requests"
  ON public.maintenance_requests
  FOR DELETE
  TO authenticated
  USING (
    is_staff((SELECT auth.uid()))
  );