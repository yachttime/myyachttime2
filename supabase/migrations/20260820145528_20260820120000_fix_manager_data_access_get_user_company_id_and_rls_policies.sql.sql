/*
# Fix Manager-Role Data Access (get_user_company_id + RLS policies)

## Problem
Manager-role users (e.g., Roland Rick, manager of yacht ELATION) see no data
after logging in -- no calendar trips, no repair requests, no invoice details.

## Root Causes

1. **Broken `get_user_company_id()` function**: The function queries
   `WHERE id = auth.uid()` but `id` is the table's auto-generated primary key
   UUID, NOT the auth user ID. The auth user ID is stored in the `user_id`
   column. This causes the function to always return NULL, breaking every
   RLS policy that relies on `company_id = get_user_company_id()`.

2. **Missing `manager` in yacht_bookings "Staff can view all bookings" policy**:
   The SELECT policy includes roles `staff`, `mechanic`, `master` but NOT
   `manager`. Managers fall through to the "Users can view company bookings"
   policy which uses the broken `get_user_company_id()`, so they see nothing.

3. **Missing `manager` in yacht_invoices SELECT policy for company-wide access**:
   The policy only lets managers see invoices for their assigned yacht
   (`user_profiles.yacht_id = yacht_invoices.yacht_id`). Managers should see
   all invoices for their company, consistent with staff/mechanic/master.

## Changes

### 1. Fix `get_user_company_id()` function
- Use CREATE OR REPLACE to change the function body from
  `WHERE id = auth.uid()` to `WHERE user_id = auth.uid()`.
- Add SECURITY DEFINER and fixed search_path for security.

### 2. Update yacht_bookings SELECT policy
- Drop and recreate "Staff can view all bookings" to include `manager` in
  the role array alongside staff, mechanic, master.

### 3. Update yacht_invoices SELECT policy
- Drop and recreate "yacht_invoices_select_policy" to include `manager` in
  the role array alongside staff, mechanic, master (company-wide access).

## Security Notes
- The `get_user_company_id()` fix uses SECURITY DEFINER with a fixed
  search_path to prevent search_path injection.
- Manager role additions are consistent with existing staff/mechanic/master
  access patterns -- managers are trusted company personnel who need
  company-wide visibility.
*/

-- 1. Fix get_user_company_id() function (CREATE OR REPLACE to preserve dependents)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Fix yacht_bookings: add manager to "Staff can view all bookings" SELECT policy
DROP POLICY IF EXISTS "Staff can view all bookings" ON public.yacht_bookings;

CREATE POLICY "Staff can view all bookings"
ON public.yacht_bookings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'manager'::user_role, 'master'::user_role])
    AND user_profiles.is_active = true
  )
);

-- 3. Fix yacht_invoices: add manager to SELECT policy for company-wide access
DROP POLICY IF EXISTS "yacht_invoices_select_policy" ON public.yacht_invoices;

CREATE POLICY "yacht_invoices_select_policy"
ON public.yacht_invoices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND (
      user_profiles.role = ANY (ARRAY['staff'::user_role, 'mechanic'::user_role, 'manager'::user_role, 'master'::user_role])
      OR (user_profiles.role = 'owner'::user_role AND user_profiles.yacht_id = yacht_invoices.yacht_id)
    )
    AND user_profiles.is_active = true
  )
);
