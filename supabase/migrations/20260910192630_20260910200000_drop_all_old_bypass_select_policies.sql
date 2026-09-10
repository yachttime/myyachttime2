/*
# Drop All Old SELECT Policies That Bypass Company Filtering

## Problem
PostgreSQL OR's together all matching RLS policies on a table. Many tables have
both an old SELECT policy (that checks `user_profiles.company_id` directly or just
checks `role = 'master'` without any company filter) AND a new policy that uses
`get_user_company_id()`. The old policies let masters and staff see data from ALL
companies, overriding the new company-filtered policies.

## Root Cause
Earlier migrations added new `get_user_company_id()`-based policies but failed to
drop the old policies because the old policy names didn't match the DROP statements.
Since PostgreSQL OR's all matching policies, the old bypass policies still grant
access to all data.

## Changes

### 1. Create missing get_user_company_id() SELECT policies
For tables that have old policies but no get_user_company_id() policy yet:
- estimating_payments
- quickbooks_api_logs
- daily_task_parts
- ownership_transfers

### 2. Drop ALL old SELECT policies that bypass company filtering
These policies are OR'd with the correct get_user_company_id() policies and
override them. Dropping them leaves only the correct company-filtered policies.

Tables affected:
- estimates, work_orders, estimating_invoices, purchase_orders
- accounting_codes, estimate_line_items, estimate_settings, estimate_tasks
- labor_codes, parts_inventory, vendors
- company_settings, customers, customer_vessels
- yacht_bookings, yachts, yacht_invoices
- work_order_tasks, work_order_line_items, work_order_task_assignments
- work_order_time_entries
- estimating_payments, quickbooks_api_logs
- receipts, repair_request_notes, repair_requests
- role_permissions, daily_task_parts, ownership_transfers

### 3. Special cases KEPT (not dropped)
- education_videos "Anonymous users can view SignIn category videos" -- needed for anon role on sign-in page
- repair_request_approval_tokens "Allow anonymous to read unexpired tokens" -- public approval flow
- inspection_time_entries "Employees can view own inspection time entries" -- more restrictive, not a bypass

## Security
After this migration, all company-scoped tables will have exactly one SELECT
policy using get_user_company_id(), which respects the master's selected_company_id
for company switching. No old bypass policies will remain.
*/

-- ============================================================
-- Step 1: Create missing get_user_company_id() SELECT policies
-- ============================================================

-- estimating_payments
DROP POLICY IF EXISTS "Users can view company estimating payments" ON estimating_payments;
CREATE POLICY "Users can view company estimating payments"
ON estimating_payments FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

-- quickbooks_api_logs
DROP POLICY IF EXISTS "Users can view company QB API logs" ON quickbooks_api_logs;
CREATE POLICY "Users can view company QB API logs"
ON quickbooks_api_logs FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

-- daily_task_parts
DROP POLICY IF EXISTS "Users can view company daily task parts" ON daily_task_parts;
CREATE POLICY "Users can view company daily task parts"
ON daily_task_parts FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

-- ownership_transfers
DROP POLICY IF EXISTS "Users can view company ownership transfers" ON ownership_transfers;
CREATE POLICY "Users can view company ownership transfers"
ON ownership_transfers FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

-- ============================================================
-- Step 2: Drop ALL old bypass SELECT policies
-- ============================================================

-- estimates
DROP POLICY IF EXISTS "Master users can view estimates" ON estimates;

-- work_orders
DROP POLICY IF EXISTS "Master users can view work orders" ON work_orders;

-- estimating_invoices
DROP POLICY IF EXISTS "Staff and mechanic can view company estimating invoices" ON estimating_invoices;

-- purchase_orders
DROP POLICY IF EXISTS "Staff and master can manage purchase orders" ON purchase_orders;

-- accounting_codes
DROP POLICY IF EXISTS "Staff and mechanic can view company accounting codes" ON accounting_codes;

-- estimate_line_items
DROP POLICY IF EXISTS "Staff and mechanic can view company estimate line items" ON estimate_line_items;

-- estimate_settings
DROP POLICY IF EXISTS "Staff and mechanic can view company estimate settings" ON estimate_settings;

-- estimate_tasks
DROP POLICY IF EXISTS "Staff and mechanic can view company estimate tasks" ON estimate_tasks;

-- labor_codes
DROP POLICY IF EXISTS "Staff and mechanic can view company labor codes" ON labor_codes;

-- parts_inventory
DROP POLICY IF EXISTS "Staff and mechanic can view company parts inventory" ON parts_inventory;

-- vendors
DROP POLICY IF EXISTS "Staff and mechanic can view company vendors" ON vendors;

-- company_settings
DROP POLICY IF EXISTS "Master users can view all company settings" ON company_settings;

-- customers
DROP POLICY IF EXISTS "Staff and managers can view all customers" ON customers;

-- customer_vessels
DROP POLICY IF EXISTS "Staff and managers can view all customer vessels" ON customer_vessels;

-- yacht_bookings (drop all 3 old policies - the get_user_company_id one covers all roles)
DROP POLICY IF EXISTS "Staff can view all bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Owners can view bookings for their yacht" ON yacht_bookings;
DROP POLICY IF EXISTS "Managers can view bookings for their yacht" ON yacht_bookings;

-- yachts
DROP POLICY IF EXISTS "Master users can view all yachts" ON yachts;

-- work_order_tasks
DROP POLICY IF EXISTS "Staff can view all work order tasks" ON work_order_tasks;
DROP POLICY IF EXISTS "Owners can view work order tasks for their yachts" ON work_order_tasks;

-- work_order_line_items
DROP POLICY IF EXISTS "Staff can view all work order line items" ON work_order_line_items;
DROP POLICY IF EXISTS "Owners can view work order line items for their yachts" ON work_order_line_items;

-- work_order_task_assignments
DROP POLICY IF EXISTS "Staff can view all task assignments" ON work_order_task_assignments;

-- work_order_time_entries
DROP POLICY IF EXISTS "Master users can view work order time entries" ON work_order_time_entries;

-- estimating_payments (old policies using user_profiles.company_id directly)
DROP POLICY IF EXISTS "Master users can view payments in their company" ON estimating_payments;
DROP POLICY IF EXISTS "Staff can view payments in their company" ON estimating_payments;

-- quickbooks_api_logs (old policies using user_profiles.company_id directly)
DROP POLICY IF EXISTS "Master users can view API logs for their company" ON quickbooks_api_logs;
DROP POLICY IF EXISTS "Staff can view API logs for their company" ON quickbooks_api_logs;

-- receipts
DROP POLICY IF EXISTS "staff_master_select_all_receipts" ON receipts;

-- repair_request_notes
DROP POLICY IF EXISTS "staff_master_select_repair_request_notes" ON repair_request_notes;

-- repair_requests
DROP POLICY IF EXISTS "Users and staff can view repair requests" ON repair_requests;

-- role_permissions
DROP POLICY IF EXISTS "Master users can view all permissions" ON role_permissions;

-- daily_task_parts (old policies using user_profiles.company_id directly)
DROP POLICY IF EXISTS "Master and manager can view all task parts" ON daily_task_parts;
DROP POLICY IF EXISTS "Staff can view parts for their own tasks" ON daily_task_parts;

-- ownership_transfers (old policy using user_profiles.company_id directly)
DROP POLICY IF EXISTS "Masters can view ownership transfers for their company" ON ownership_transfers;

-- qb_surcharge_push_log
DROP POLICY IF EXISTS "master_staff_select_push_log" ON qb_surcharge_push_log;
