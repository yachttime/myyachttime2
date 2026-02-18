/*
  # Make Contact Fields Nullable in Estimating Invoices
  
  1. Changes
    - Make customer_email nullable in estimating_invoices
    - Make customer_phone nullable in estimating_invoices
    - These fields are optional for yacht-based invoices where we bill the yacht owner
*/

-- Make customer email nullable
ALTER TABLE estimating_invoices 
ALTER COLUMN customer_email DROP NOT NULL;

-- Make customer phone nullable
ALTER TABLE estimating_invoices 
ALTER COLUMN customer_phone DROP NOT NULL;