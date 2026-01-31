/*
  # Add Vendor Contact and Account Fields

  1. Changes to Existing Tables
    - Update `vendors` table:
      - Add `address` (text) - Full street address
      - Add `account_number` (text) - Vendor account number
      - Add `account_rep_name` (text) - Sales/account representative name
      - Add `account_rep_phone` (text) - Sales rep phone number
      - Add `account_rep_email` (text) - Sales rep email
      - Add `accounting_rep_name` (text) - Accounting contact name
      - Add `accounting_rep_phone` (text) - Accounting contact phone
      - Add `accounting_rep_email` (text) - Accounting contact email

  2. Important Notes
    - Existing vendor records will have NULL values for new fields
    - All new fields are optional to maintain flexibility
*/

-- Add new fields to vendors table
DO $$
BEGIN
  -- Address field (combining previous address, city, state, zip if needed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE vendors ADD COLUMN account_number text;
  END IF;

  -- Account representative fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'account_rep_name'
  ) THEN
    ALTER TABLE vendors ADD COLUMN account_rep_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'account_rep_phone'
  ) THEN
    ALTER TABLE vendors ADD COLUMN account_rep_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'account_rep_email'
  ) THEN
    ALTER TABLE vendors ADD COLUMN account_rep_email text;
  END IF;

  -- Accounting representative fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'accounting_rep_name'
  ) THEN
    ALTER TABLE vendors ADD COLUMN accounting_rep_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'accounting_rep_phone'
  ) THEN
    ALTER TABLE vendors ADD COLUMN accounting_rep_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'accounting_rep_email'
  ) THEN
    ALTER TABLE vendors ADD COLUMN accounting_rep_email text;
  END IF;
END $$;
