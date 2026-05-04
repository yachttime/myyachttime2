/*
  # Add check and cash to yacht_invoices payment_method_type constraint

  Expands the allowed values for payment_method_type on yacht_invoices
  to include 'check' and 'cash' in addition to the existing 'card', 'ach', 'both'.
*/

ALTER TABLE yacht_invoices
  DROP CONSTRAINT IF EXISTS yacht_invoices_payment_method_type_check;

ALTER TABLE yacht_invoices
  ADD CONSTRAINT yacht_invoices_payment_method_type_check
  CHECK (payment_method_type IN ('card', 'ach', 'both', 'check', 'cash'));
