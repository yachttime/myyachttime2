/*
  # Backfill company_id on all estimating tables

  ## Problem
  Multiple estimating tables have company_id = NULL, which blocks staff members
  from accessing them because the RLS policies compare company_id equality
  (NULL = NULL is false in SQL).

  ## Tables with null company_id (counts at time of migration)
  - estimates: 3
  - estimate_line_items: 20
  - estimate_tasks: 1
  - estimate_packages: 1
  - work_orders: 2
  - work_order_tasks: 40
  - work_order_line_items: 407
  - parts_inventory: 28
  - vendors: 4

  ## Fix
  Backfill all NULL company_id values to AZ Marine (the primary company).
  All existing data was created before multi-company support and belongs to AZ Marine.
*/

UPDATE estimates
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE estimate_line_items
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE estimate_tasks
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE estimate_packages
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE work_orders
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE work_order_tasks
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE work_order_line_items
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE parts_inventory
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE vendors
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE estimating_invoices
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE estimating_payments
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

UPDATE purchase_orders
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;
