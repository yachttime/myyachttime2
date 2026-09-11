/*
# Fix estimates RLS to allow owner role to create estimates

## Problem
The `is_staff()` function only returns true for roles: staff, manager, mechanic, master.
Owners cannot create estimates because the INSERT policy requires `is_staff()` to be true.
This causes "new row violates row-level security policy" when an owner tries to save an estimate.

## Fix
Update the INSERT, UPDATE, and DELETE policies on the `estimates` table to also allow
the `owner` role, by adding an OR condition checking for owner role with matching company_id.

## Changes
1. Drop and recreate the "Staff can insert company estimates" policy to include owner role
2. Drop and recreate the "Staff can update company estimates" policy to include owner role
3. Drop and recreate the "Staff can delete company estimates" policy to include owner role
*/

DROP POLICY IF EXISTS "Staff can insert company estimates" ON estimates;
CREATE POLICY "Staff can insert company estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_staff()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'owner'
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can update company estimates" ON estimates;
CREATE POLICY "Staff can update company estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_staff()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'owner'
        AND user_profiles.is_active = true
      )
    )
  )
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_staff()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'owner'
        AND user_profiles.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff can delete company estimates" ON estimates;
CREATE POLICY "Staff can delete company estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_staff()
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'owner'
        AND user_profiles.is_active = true
      )
    )
  );
