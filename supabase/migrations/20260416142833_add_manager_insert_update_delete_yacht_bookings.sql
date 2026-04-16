/*
  # Add manager role to yacht_bookings INSERT, UPDATE, DELETE policies

  ## Summary
  Managers like Annelle Well were blocked from adding, editing, or deleting
  trip information because the INSERT, UPDATE, and DELETE RLS policies on
  yacht_bookings only allowed 'staff' and 'master' roles.

  ## Changes
  - Drop the old staff-only INSERT, UPDATE, DELETE policies on yacht_bookings
  - Recreate them to include the 'manager' role alongside 'staff' and 'master'

  ## Notes
  - SELECT policies already include manager (separate policy exists)
  - The is_staff() function already includes manager, but the named policies
    used explicit role array checks that excluded manager
*/

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Staff can insert bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Staff can delete bookings" ON yacht_bookings;

-- Recreate with manager included
CREATE POLICY "Staff and managers can insert bookings"
  ON yacht_bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'manager'::user_role, 'master'::user_role])
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and managers can update bookings"
  ON yacht_bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'manager'::user_role, 'master'::user_role])
        AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'manager'::user_role, 'master'::user_role])
        AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and managers can delete bookings"
  ON yacht_bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'manager'::user_role, 'master'::user_role])
        AND user_profiles.is_active = true
    )
  );
