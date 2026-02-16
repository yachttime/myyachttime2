/*
  # Add company_id to Inventory and Financial Tables - Part 3

  1. Tables Updated
    - parts_inventory - Add company_id, index
    - part_transactions - Add company_id, index
    - mercury_marine_parts - Add company_id, index
    - mercury_price_list_imports - Add company_id, index
    - labor_codes - Add company_id, index
    - accounting_codes - Add company_id, index
    - vendors - Add company_id, index
    - estimate_packages - Add company_id, index
    - estimate_package_labor - Add company_id, index
    - estimate_package_parts - Add company_id, index
    - estimate_fees_config - Add company_id, index
    - estimate_settings - Add company_id, index

  2. Notes
    - Each company has their own parts inventory
    - Each company has their own labor codes and rates
    - Each company has their own accounting codes
    - Complete financial isolation
*/

-- Parts inventory table
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_company_id ON parts_inventory(company_id);

-- Part transactions table
ALTER TABLE part_transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_part_transactions_company_id ON part_transactions(company_id);

-- Mercury marine parts table
ALTER TABLE mercury_marine_parts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_mercury_marine_parts_company_id ON mercury_marine_parts(company_id);

-- Mercury price list imports table
ALTER TABLE mercury_price_list_imports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_mercury_price_list_imports_company_id ON mercury_price_list_imports(company_id);

-- Labor codes table
ALTER TABLE labor_codes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_labor_codes_company_id ON labor_codes(company_id);

-- Accounting codes table
ALTER TABLE accounting_codes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_accounting_codes_company_id ON accounting_codes(company_id);

-- Vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON vendors(company_id);

-- Estimate packages table
ALTER TABLE estimate_packages ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_packages_company_id ON estimate_packages(company_id);

-- Estimate package labor table
ALTER TABLE estimate_package_labor ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_package_labor_company_id ON estimate_package_labor(company_id);

-- Estimate package parts table
ALTER TABLE estimate_package_parts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_package_parts_company_id ON estimate_package_parts(company_id);

-- Estimate fees config table
ALTER TABLE estimate_fees_config ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_fees_config_company_id ON estimate_fees_config(company_id);

-- Estimate settings table
ALTER TABLE estimate_settings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_settings_company_id ON estimate_settings(company_id);
