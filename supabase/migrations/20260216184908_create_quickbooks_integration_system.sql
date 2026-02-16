/*
  # Create QuickBooks Online Integration System

  1. New Tables
    - `quickbooks_connection`
      - Stores QuickBooks Online OAuth credentials and connection status
      - Fields: id, company_name, realm_id, access_token_encrypted, refresh_token_encrypted, 
        token_expires_at, connected_at, last_sync_at, is_active, created_by, created_at, updated_at
      - Only one active connection allowed
      - Only master role can manage connections
    
    - `quickbooks_accounts`
      - Stores the Chart of Accounts from QuickBooks
      - Fields: id, qbo_account_id, account_name, account_type, account_subtype, 
        fully_qualified_name, active, classification, account_number, description, 
        last_synced_at, created_at, updated_at
      - Synced from QuickBooks periodically
    
    - `quickbooks_account_mappings`
      - Maps internal accounting codes to QuickBooks accounts
      - Fields: id, mapping_type (labor, parts, tax, surcharge, income, expense), 
        internal_code_id (references accounting_codes or labor_codes), 
        qbo_account_id (references quickbooks_accounts), 
        is_default, notes, created_by, created_at, updated_at
      - Allows flexible mapping of different transaction types
  
  2. Security
    - Enable RLS on all tables
    - Only master role can manage connections and mappings
    - All staff can view mappings for estimates
  
  3. Integration Points
    - Estimates can be pushed to QuickBooks as Estimates
    - Work Orders can be pushed as Sales Receipts or Invoices
    - Parts inventory can sync with QuickBooks Items
    - Labor codes map to Service Items
*/

-- Create quickbooks_connection table
CREATE TABLE IF NOT EXISTS quickbooks_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  realm_id varchar(50) NOT NULL UNIQUE,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  connected_at timestamptz DEFAULT now(),
  last_sync_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quickbooks_accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS quickbooks_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_account_id varchar(50) NOT NULL UNIQUE,
  account_name varchar(100) NOT NULL,
  account_type varchar(50) NOT NULL,
  account_subtype varchar(50),
  fully_qualified_name text,
  active boolean DEFAULT true,
  classification varchar(20),
  account_number varchar(20),
  description text,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_quickbooks_accounts_qbo_id ON quickbooks_accounts(qbo_account_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_accounts_type ON quickbooks_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_quickbooks_accounts_active ON quickbooks_accounts(active);

-- Create quickbooks_account_mappings table
CREATE TABLE IF NOT EXISTS quickbooks_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_type varchar(20) NOT NULL CHECK (mapping_type IN ('labor', 'parts', 'tax', 'surcharge', 'income', 'expense', 'cogs', 'inventory_asset')),
  internal_code_id uuid,
  internal_code_type varchar(20) CHECK (internal_code_type IN ('accounting_code', 'labor_code', 'tax', 'surcharge')),
  qbo_account_id varchar(50) NOT NULL,
  is_default boolean DEFAULT false,
  notes text,
  created_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(mapping_type, internal_code_id)
);

-- Create indexes for mappings
CREATE INDEX IF NOT EXISTS idx_qbo_mappings_type ON quickbooks_account_mappings(mapping_type);
CREATE INDEX IF NOT EXISTS idx_qbo_mappings_internal_code ON quickbooks_account_mappings(internal_code_id);

-- Add QuickBooks sync tracking to estimates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'qbo_estimate_id'
  ) THEN
    ALTER TABLE estimates ADD COLUMN qbo_estimate_id varchar(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'qbo_synced_at'
  ) THEN
    ALTER TABLE estimates ADD COLUMN qbo_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'qbo_sync_status'
  ) THEN
    ALTER TABLE estimates ADD COLUMN qbo_sync_status varchar(20) CHECK (qbo_sync_status IN ('pending', 'synced', 'failed', 'not_synced'));
  END IF;
END $$;

-- Add QuickBooks sync tracking to work orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'qbo_invoice_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN qbo_invoice_id varchar(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'qbo_synced_at'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN qbo_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'qbo_sync_status'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN qbo_sync_status varchar(20) CHECK (qbo_sync_status IN ('pending', 'synced', 'failed', 'not_synced'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE quickbooks_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_account_mappings ENABLE ROW LEVEL SECURITY;

-- Policies for quickbooks_connection
CREATE POLICY "Masters can view QuickBooks connection"
  ON quickbooks_connection FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can insert QuickBooks connection"
  ON quickbooks_connection FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update QuickBooks connection"
  ON quickbooks_connection FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can delete QuickBooks connection"
  ON quickbooks_connection FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policies for quickbooks_accounts
CREATE POLICY "Staff can view QuickBooks accounts"
  ON quickbooks_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Masters can insert QuickBooks accounts"
  ON quickbooks_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update QuickBooks accounts"
  ON quickbooks_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policies for quickbooks_account_mappings
CREATE POLICY "Staff can view QuickBooks mappings"
  ON quickbooks_account_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Masters can insert QuickBooks mappings"
  ON quickbooks_account_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update QuickBooks mappings"
  ON quickbooks_account_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can delete QuickBooks mappings"
  ON quickbooks_account_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );