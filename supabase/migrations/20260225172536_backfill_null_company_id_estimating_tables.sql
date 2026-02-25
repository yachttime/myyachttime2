/*
  # Backfill NULL company_id on estimating tables

  ## Summary
  Records created before the multi-company system was introduced have company_id = NULL.
  The RLS policy `company_id = get_user_company_id()` does not match NULL, so staff/mechanic
  users assigned to AZ Marine could not see these records.

  ## Changes
  - Updates all NULL company_id rows in estimates, work_orders, estimating_invoices,
    estimate_line_items, work_order_line_items, work_order_tasks, estimating_payments,
    parts_inventory, labor_codes, accounting_codes, vendors, purchase_orders,
    and estimate_packages to AZ Marine's company ID.

  ## Notes
  - Only rows where company_id IS NULL are touched — no existing assignments are changed.
  - AZ Marine company ID: 519b4394-d35c-46d7-997c-db7e46178ef5
*/

DO $$
DECLARE
  az_marine_id uuid := '519b4394-d35c-46d7-997c-db7e46178ef5';
BEGIN

  UPDATE estimates SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE work_orders SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE estimating_invoices SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE estimate_line_items SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE work_order_line_items SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE work_order_tasks SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE estimating_payments SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE parts_inventory SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE labor_codes SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE accounting_codes SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE vendors SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE purchase_orders SET company_id = az_marine_id WHERE company_id IS NULL;

  UPDATE estimate_packages SET company_id = az_marine_id WHERE company_id IS NULL;

END $$;
