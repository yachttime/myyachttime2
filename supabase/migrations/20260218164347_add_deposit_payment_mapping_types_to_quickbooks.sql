/*
  # Add deposit and payment mapping types to QuickBooks account mappings

  ## Summary
  Extends the QuickBooks account mapping system to support deposit and payment
  account types, enabling proper reconciliation of deposits and payments with
  QuickBooks when using the estimating system.

  ## Changes
  1. `quickbooks_account_mappings` - Alters the mapping_type CHECK constraint to
     include two new values:
     - `deposit` - maps to the liability/deferred revenue account where customer
       deposits are recorded when collected
     - `payment` - maps to the bank/undeposited funds account where invoice
       payments are received

  ## Notes
  - Existing data is unaffected; the constraint is only expanded, not restricted
  - The internal_code_type constraint is unchanged
*/

ALTER TABLE quickbooks_account_mappings
  DROP CONSTRAINT IF EXISTS quickbooks_account_mappings_mapping_type_check;

ALTER TABLE quickbooks_account_mappings
  ADD CONSTRAINT quickbooks_account_mappings_mapping_type_check
  CHECK (mapping_type IN (
    'labor',
    'parts',
    'tax',
    'surcharge',
    'income',
    'expense',
    'cogs',
    'inventory_asset',
    'deposit',
    'payment'
  ));
