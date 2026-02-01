/*
  # Fix Yacht Bookings RLS for Master Calendar

  1. Problem
    - Master calendar not showing any bookings for staff/master users
    - RLS policies on yacht_bookings are too restrictive
    - Jan 16 security update broke access for staff viewing all bookings

  2. Solution
    - Drop all existing yacht_bookings policies
    - Recreate policies that properly allow:
      - Staff, mechanic, and master roles to see ALL bookings
      - Owners to see bookings for their yacht(s)
      - Managers to see bookings for their assigned yacht

  3. Security
    - Maintains proper access control
    - Staff/Master/Mechanic can view/manage all bookings (needed for calendar)
    - Owners only see their yacht's bookings
    - Managers only see their yacht's bookings
*/

-- Drop all existing yacht_bookings policies
DROP POLICY IF EXISTS "Users can view bookings for their yacht or staff can view all" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Owners can view bookings for their yacht" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Staff can view all bookings" ON public.yacht_bookings;
DROP POLICY IF EXISTS "Staff can manage bookings" ON public.yacht_bookings;

-- SELECT Policy: Allow staff/master/mechanic to see all, owners/managers to see their yacht's
CREATE POLICY "Staff can view all bookings"
  ON public.yacht_bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Owners can view bookings for their yacht"
  ON public.yacht_bookings
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id IS NOT NULL
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers can view bookings for their yacht"
  ON public.yacht_bookings
  FOR SELECT
  TO authenticated
  USING (
    yacht_id IN (
      SELECT yacht_id FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id IS NOT NULL
      AND user_profiles.is_active = true
    )
  );

-- INSERT Policy: Only staff and master can create bookings
CREATE POLICY "Staff can insert bookings"
  ON public.yacht_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- UPDATE Policy: Staff and master can update all bookings
CREATE POLICY "Staff can update bookings"
  ON public.yacht_bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );

-- DELETE Policy: Only staff and master can delete bookings
CREATE POLICY "Staff can delete bookings"
  ON public.yacht_bookings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
      AND user_profiles.is_active = true
    )
  );
