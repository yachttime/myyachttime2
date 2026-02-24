/*
  # Add 'check' to work_orders deposit_payment_method_type constraint

  ## Changes
  - Drops the existing check constraint on work_orders.deposit_payment_method_type
  - Recreates it to also allow 'check' as a valid payment method type

  ## Reason
  The application supports check payments for deposits on work orders,
  but the constraint was missing 'check' as an allowed value.
*/

ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_deposit_payment_method_type_check;

ALTER TABLE work_orders ADD CONSTRAINT work_orders_deposit_payment_method_type_check
  CHECK (deposit_payment_method_type = ANY (ARRAY['card'::text, 'ach'::text, 'check'::text]));
