/*
  # Add QuickBooks Integration Fields

  1. Changes
    - Add qbo_customer_id to customers table for QuickBooks customer reference
    - Add qbo_invoice_id and qbo_synced_at to yacht_invoices for invoice sync tracking
    - Add company_id to quickbooks_connection table for multi-company support

  2. Notes
    - These fields enable tracking of synced records between Yacht Time and QuickBooks
    - The qbo_customer_id prevents duplicate customer creation
    - The qbo_invoice_id tracks which invoices have been pushed to QuickBooks
*/

-- Add qbo_customer_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'qbo_customer_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN qbo_customer_id varchar(50);
  END IF;
END $$;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_qbo_customer_id ON customers(qbo_customer_id);

-- Add qbo_invoice_id and qbo_synced_at to yacht_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'qbo_invoice_id'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN qbo_invoice_id varchar(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'qbo_synced_at'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN qbo_synced_at timestamptz;
  END IF;
END $$;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_qbo_invoice_id ON yacht_invoices(qbo_invoice_id);

-- Add company_id to quickbooks_connection table for multi-company support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quickbooks_connection' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE quickbooks_connection ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on company_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_quickbooks_connection_company_id ON quickbooks_connection(company_id);
