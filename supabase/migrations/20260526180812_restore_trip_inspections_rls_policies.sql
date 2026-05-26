/*
  # Restore trip_inspections RLS Policies

  ## Problem
  A prior migration (20260116143539) dropped and recreated only the SELECT policy
  on trip_inspections, leaving INSERT, UPDATE, and DELETE policies missing entirely.
  This caused all inserts to be blocked with an RLS violation error.

  ## Changes
  - Restores INSERT policy: staff/master/mechanic/manager roles can insert
  - Restores UPDATE policy: staff/master/mechanic/manager roles can update
  - Restores DELETE policy: staff/master/mechanic/manager roles can delete
  - Recreates SELECT policy using the optimized auth.uid() subselect pattern
*/

-- SELECT
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

-- INSERT
DROP POLICY IF EXISTS "Staff and managers can insert inspections" ON public.trip_inspections;
CREATE POLICY "Staff and managers can insert inspections"
  ON public.trip_inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff((SELECT auth.uid())));

-- UPDATE
DROP POLICY IF EXISTS "Staff and managers can update inspections" ON public.trip_inspections;
CREATE POLICY "Staff and managers can update inspections"
  ON public.trip_inspections
  FOR UPDATE
  TO authenticated
  USING (is_staff((SELECT auth.uid())))
  WITH CHECK (is_staff((SELECT auth.uid())));

-- DELETE
DROP POLICY IF EXISTS "Staff can delete trip inspections" ON public.trip_inspections;
CREATE POLICY "Staff can delete trip inspections"
  ON public.trip_inspections
  FOR DELETE
  TO authenticated
  USING (is_staff((SELECT auth.uid())));
