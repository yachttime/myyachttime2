/*
  # Make estimating_payments customer_name nullable

  ## Changes
  - Alters the customer_name column in estimating_payments to allow NULL values

  ## Reason
  Yacht-based (non-retail) work orders do not have a customer_name — the vessel 
  is identified by yacht. Requiring customer_name breaks check deposit recording 
  for these work orders.
*/

ALTER TABLE estimating_payments ALTER COLUMN customer_name DROP NOT NULL;
