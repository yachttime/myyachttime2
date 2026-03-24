/*
  # Relax repair_requests customer type check constraint

  The existing constraint requires customer_phone and customer_email to be NOT NULL
  for retail customers, but estimates often don't have these fields populated.

  This migration relaxes the constraint to only require customer_name for retail
  customers, making email and phone optional.
*/

ALTER TABLE repair_requests DROP CONSTRAINT IF EXISTS repair_requests_customer_type_check;

ALTER TABLE repair_requests ADD CONSTRAINT repair_requests_customer_type_check
  CHECK (
    ((yacht_id IS NOT NULL) AND (is_retail_customer = false))
    OR
    ((yacht_id IS NULL) AND (is_retail_customer = true) AND (customer_name IS NOT NULL))
  );
