/*
  # Make Yacht Invoices Support Retail Customers

  1. Changes to `yacht_invoices` table
    - Make `yacht_id` nullable to support retail customer invoices
    - Retail customer invoices will have a NULL yacht_id
    - Keep foreign key constraint with ON DELETE CASCADE for yacht-related invoices

  2. Security
    - Existing RLS policies already handle NULL yacht_id appropriately
    - Staff policies allow viewing/managing all invoices regardless of yacht_id
    - Manager policies already use EXISTS checks that will safely exclude NULL yacht_id rows

  3. Notes
    - This allows invoices to be created for retail customer repair requests
    - Retail customer invoices are identified by having yacht_id = NULL
    - All existing yacht-based invoices remain unchanged
*/

-- Make yacht_id nullable to support retail customers
ALTER TABLE yacht_invoices ALTER COLUMN yacht_id DROP NOT NULL;
