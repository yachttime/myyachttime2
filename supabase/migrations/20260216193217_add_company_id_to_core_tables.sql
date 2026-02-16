/*
  # Add company_id to Core Tables - Part 1

  1. Tables Updated
    - yachts - Add company_id, index
    - customers - Add company_id, index
    - customer_vessels - Add company_id, index
    - yacht_bookings - Add company_id, index
    - yacht_booking_owners - Add company_id, index
    - trip_inspections - Add company_id, index
    - owner_handoff_inspections - Add company_id, index
    - yacht_documents - Add company_id, index
    - yacht_history_logs - Add company_id, index
    - yacht_budgets - Add company_id, index
    - yacht_invoices - Add company_id, index
    - yacht_smart_devices - Add company_id, index

  2. Migration Strategy
    - Add column as nullable first
    - Will populate with AZ Marine company_id in next migration
    - Then make NOT NULL after data migration
    - Create indexes for performance

  3. Notes
    - All yacht-related and customer-related data must be company-specific
    - Complete data isolation between companies
*/

-- Yachts table
ALTER TABLE yachts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yachts_company_id ON yachts(company_id);

-- Customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- Customer vessels table
ALTER TABLE customer_vessels ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_customer_vessels_company_id ON customer_vessels(company_id);

-- Yacht bookings table
ALTER TABLE yacht_bookings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_bookings_company_id ON yacht_bookings(company_id);

-- Yacht booking owners table
ALTER TABLE yacht_booking_owners ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_booking_owners_company_id ON yacht_booking_owners(company_id);

-- Trip inspections table
ALTER TABLE trip_inspections ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_trip_inspections_company_id ON trip_inspections(company_id);

-- Owner handoff inspections table
ALTER TABLE owner_handoff_inspections ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_owner_handoff_inspections_company_id ON owner_handoff_inspections(company_id);

-- Yacht documents table
ALTER TABLE yacht_documents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_documents_company_id ON yacht_documents(company_id);

-- Yacht history logs table
ALTER TABLE yacht_history_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_history_logs_company_id ON yacht_history_logs(company_id);

-- Yacht budgets table
ALTER TABLE yacht_budgets ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_budgets_company_id ON yacht_budgets(company_id);

-- Yacht invoices table
ALTER TABLE yacht_invoices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_company_id ON yacht_invoices(company_id);

-- Yacht smart devices table
ALTER TABLE yacht_smart_devices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_yacht_smart_devices_company_id ON yacht_smart_devices(company_id);
