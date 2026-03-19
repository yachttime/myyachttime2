/*
  # Auto-assign company_id Trigger for Estimating Tables

  ## Problem
  The estimating system repeatedly runs into issues where new records are inserted
  without a company_id. Because RLS policies filter by company_id, records with
  NULL company_id become invisible to staff users (NULL != NULL in SQL), causing
  "missing data" bugs that keep recurring whenever new features are added.

  ## Solution
  A BEFORE INSERT trigger function that automatically populates company_id from
  the current user's profile if it is not explicitly provided. This acts as a
  safety net so that even if a developer forgets to include company_id, the
  record still gets the correct value.

  ## Tables Covered
  - estimates
  - estimate_tasks
  - estimate_line_items
  - estimate_packages
  - estimate_package_labor
  - estimate_package_parts
  - work_orders
  - work_order_tasks
  - work_order_line_items
  - work_order_task_assignments
  - work_order_time_entries
  - estimating_invoices
  - estimating_payments
  - purchase_orders
  - purchase_order_line_items
  - customers
  - customer_vessels
  - parts_inventory
  - labor_codes
  - accounting_codes
  - vendors

  ## Notes
  - Only fires when company_id IS NULL (does not override explicitly set values)
  - Uses SECURITY DEFINER to read user_profiles even under RLS
  - Master users (role = 'master') have NULL company_id in user_profiles, so
    the trigger will also produce NULL — which is correct (masters bypass RLS)
  - Safe to run multiple times (uses CREATE OR REPLACE)
*/

-- Core trigger function: fills company_id from the inserting user's profile
CREATE OR REPLACE FUNCTION auto_assign_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id
      INTO NEW.company_id
      FROM user_profiles
     WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Helper macro: attach the trigger to a table if not already present
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'estimates',
    'estimate_tasks',
    'estimate_line_items',
    'estimate_packages',
    'estimate_package_labor',
    'estimate_package_parts',
    'work_orders',
    'work_order_tasks',
    'work_order_line_items',
    'work_order_task_assignments',
    'work_order_time_entries',
    'estimating_invoices',
    'estimating_payments',
    'purchase_orders',
    'purchase_order_line_items',
    'customers',
    'customer_vessels',
    'parts_inventory',
    'labor_codes',
    'accounting_codes',
    'vendors'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Only create trigger if the table exists and the trigger doesn't already exist
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
       WHERE trigger_schema = 'public'
         AND event_object_table = tbl
         AND trigger_name = 'trg_auto_assign_company_id'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_auto_assign_company_id
         BEFORE INSERT ON %I
         FOR EACH ROW EXECUTE FUNCTION auto_assign_company_id()',
        tbl
      );
    END IF;
  END LOOP;
END $$;
