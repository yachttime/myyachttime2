/*
  # Add Source User ID to Customers

  ## Summary
  Adds a `source_user_id` column to the `customers` table so that when a yacht owner
  is sent to the customer database, the new customer record can be linked back to
  the original user account for traceability.

  ## New Columns
  - `customers.source_user_id` (uuid, nullable) — References `auth.users(id)`.
    Set when a customer is created from a yacht owner's profile. Allows staff to
    see which yacht owner this customer originated from. No foreign key constraint
    is added to avoid complications if the auth user is deleted.

  ## Security
  No RLS policy changes needed — existing policies already cover all columns on
  this table. The column is nullable and defaults to NULL.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'source_user_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN source_user_id uuid;
  END IF;
END $$;