/*
  # Add Missing Columns to Purchase Orders

  ## Summary
  The purchase_orders table already existed with a minimal schema. This migration
  adds all the missing columns needed for the full purchase order system:
  work_order number text, customer info, vendor contact details, vendor_source,
  total_cost, and yacht_name.

  ## Changes
  - Add work_order_number (text) for quick display without join
  - Add customer_name, customer_email, customer_phone
  - Add yacht_name for vessel info
  - Add vendor_contact_name, vendor_email, vendor_phone, vendor_address, vendor_city, vendor_state, vendor_zip
  - Add vendor_source (vendor/mercury/marine_wholesale/custom)
  - Add total_cost numeric
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'work_order_number') THEN
    ALTER TABLE purchase_orders ADD COLUMN work_order_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customer_name') THEN
    ALTER TABLE purchase_orders ADD COLUMN customer_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customer_email') THEN
    ALTER TABLE purchase_orders ADD COLUMN customer_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customer_phone') THEN
    ALTER TABLE purchase_orders ADD COLUMN customer_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'yacht_name') THEN
    ALTER TABLE purchase_orders ADD COLUMN yacht_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_contact_name') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_contact_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_email') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_phone') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_address') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_city') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_state') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_zip') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_zip text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_source') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_source varchar(30) DEFAULT 'vendor';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'total_cost') THEN
    ALTER TABLE purchase_orders ADD COLUMN total_cost numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Ensure status column has the right check constraint values
-- First check what constraint exists
DO $$
BEGIN
  -- Add vendor_source check if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'purchase_orders_vendor_source_check'
  ) THEN
    ALTER TABLE purchase_orders 
      ADD CONSTRAINT purchase_orders_vendor_source_check 
      CHECK (vendor_source IN ('vendor', 'mercury', 'marine_wholesale', 'custom'));
  END IF;
END $$;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_order_id ON purchase_orders(work_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_line_items_po_id ON purchase_order_line_items(purchase_order_id);
