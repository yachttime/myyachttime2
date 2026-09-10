/*
# Fix Write Policies for Estimating Invoices and Purchase Orders

## Problem
estimating_invoices and purchase_orders have old write policies (INSERT/UPDATE/DELETE)
that bypass company filtering. Masters can write to ANY company's data, and staff can
write to data based on user_profiles.company_id (which doesn't respect selected_company_id).

## Changes

### estimating_invoices
- Create new INSERT/UPDATE/DELETE policies using get_user_company_id() + is_staff()
- Drop old "Master users can insert/update/delete estimating invoices" policies

### purchase_orders
- Create new INSERT/UPDATE/DELETE policies using get_user_company_id() + is_staff()
- Drop old "Staff and above can insert/update purchase orders" (no company check)
- Drop old "Master users can delete purchase orders" (no company check)
- Drop old "Staff and master can insert/update purchase orders" (uses user_profiles.company_id)

### yachts
- Drop old "Master can insert/delete/update yachts" policies (bypass company filter)
  since Staff policies with get_user_company_id already exist

## Security
After this migration, write access on these tables is scoped to the user's
selected company via get_user_company_id().
*/

-- ============================================================
-- estimating_invoices: create new, drop old
-- ============================================================

DROP POLICY IF EXISTS "Staff can insert company estimating invoices" ON estimating_invoices;
CREATE POLICY "Staff can insert company estimating invoices"
ON estimating_invoices FOR INSERT TO authenticated
WITH CHECK ((company_id = get_user_company_id()) AND is_staff());

DROP POLICY IF EXISTS "Staff can update company estimating invoices" ON estimating_invoices;
CREATE POLICY "Staff can update company estimating invoices"
ON estimating_invoices FOR UPDATE TO authenticated
USING ((company_id = get_user_company_id()) AND is_staff())
WITH CHECK ((company_id = get_user_company_id()) AND is_staff());

DROP POLICY IF EXISTS "Staff can delete company estimating invoices" ON estimating_invoices;
CREATE POLICY "Staff can delete company estimating invoices"
ON estimating_invoices FOR DELETE TO authenticated
USING ((company_id = get_user_company_id()) AND is_staff());

-- Drop old bypass policies
DROP POLICY IF EXISTS "Master users can insert estimating invoices" ON estimating_invoices;
DROP POLICY IF EXISTS "Master users can update estimating invoices" ON estimating_invoices;
DROP POLICY IF EXISTS "Master users can delete estimating invoices" ON estimating_invoices;

-- ============================================================
-- purchase_orders: create new, drop old
-- ============================================================

DROP POLICY IF EXISTS "Staff can insert company purchase orders" ON purchase_orders;
CREATE POLICY "Staff can insert company purchase orders"
ON purchase_orders FOR INSERT TO authenticated
WITH CHECK ((company_id = get_user_company_id()) AND is_staff());

DROP POLICY IF EXISTS "Staff can update company purchase orders" ON purchase_orders;
CREATE POLICY "Staff can update company purchase orders"
ON purchase_orders FOR UPDATE TO authenticated
USING ((company_id = get_user_company_id()) AND is_staff())
WITH CHECK ((company_id = get_user_company_id()) AND is_staff());

DROP POLICY IF EXISTS "Staff can delete company purchase orders" ON purchase_orders;
CREATE POLICY "Staff can delete company purchase orders"
ON purchase_orders FOR DELETE TO authenticated
USING ((company_id = get_user_company_id()) AND is_staff());

-- Drop old bypass policies
DROP POLICY IF EXISTS "Staff and above can insert purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Staff and master can insert purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Master users can delete purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Staff and above can update purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Staff and master can update purchase orders" ON purchase_orders;

-- ============================================================
-- yachts: drop old bypass write policies
-- (Staff policies with get_user_company_id already exist)
-- ============================================================

DROP POLICY IF EXISTS "Master can insert yachts" ON yachts;
DROP POLICY IF EXISTS "Master can delete yachts" ON yachts;
DROP POLICY IF EXISTS "Master can update yachts" ON yachts;
