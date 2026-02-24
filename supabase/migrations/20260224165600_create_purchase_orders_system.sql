/*
  # Create Purchase Orders System

  ## Summary
  Creates a purchase order system that automatically generates purchase orders when an
  estimate is converted to a work order. Purchase orders are grouped by vendor and contain
  all parts that need to be ordered (those with negative inventory or sourced from external vendors).

  ## New Tables

  ### `purchase_orders`
  - Main PO record linked to a work order
  - Tracks PO number (PO000001 format), work order, vendor, customer info, and status
  - Status: draft, sent, received, cancelled
  - Vendor info: vendor_id (for internal vendors), or vendor_name/contact/email for Mercury/Wholesale

  ### `purchase_order_line_items`
  - Individual parts on a PO
  - Linked to the work order line item for traceability
  - Tracks part number, description, quantity, unit cost, total cost

  ## Security
  - RLS enabled on both tables
  - Master, staff, mechanic, and manager roles can view and manage POs

  ## Important Notes
  1. One PO per vendor per work order (grouped by vendor)
  2. PO number auto-generated as PO000001, PO000002, etc.
  3. Linked to work_order via work_order_id
  4. Vendor info denormalized for historical accuracy
*/

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_number text NOT NULL,
  
  -- Customer info (from work order)
  customer_name text,
  customer_email text,
  customer_phone text,
  yacht_name text,
  
  -- Vendor info (denormalized for historical accuracy)
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  vendor_contact_name text,
  vendor_email text,
  vendor_phone text,
  vendor_address text,
  vendor_city text,
  vendor_state text,
  vendor_zip text,
  
  -- Source type for the vendor
  vendor_source varchar(30) DEFAULT 'vendor' CHECK (vendor_source IN ('vendor', 'mercury', 'marine_wholesale', 'custom')),
  
  -- Status tracking
  status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  
  -- Totals
  total_cost numeric(10, 2) DEFAULT 0,
  
  -- Notes
  notes text,
  
  -- Company isolation
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Metadata
  created_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create purchase_order_line_items table
CREATE TABLE IF NOT EXISTS purchase_order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  work_order_line_item_id uuid REFERENCES work_order_line_items(id) ON DELETE SET NULL,
  
  -- Part info
  part_number text,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_cost numeric(10, 2) NOT NULL DEFAULT 0,
  total_cost numeric(10, 2) NOT NULL DEFAULT 0,
  
  -- Source reference
  part_source varchar(30) DEFAULT 'custom',
  part_id uuid REFERENCES parts_inventory(id) ON DELETE SET NULL,
  mercury_part_id uuid REFERENCES mercury_marine_parts(id) ON DELETE SET NULL,
  marine_wholesale_part_id uuid REFERENCES marine_wholesale_parts(id) ON DELETE SET NULL,
  
  -- Status
  received boolean DEFAULT false,
  received_at timestamptz,
  received_quantity numeric(10, 2),
  
  -- Order
  line_order integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_order_id ON purchase_orders(work_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_line_items_po_id ON purchase_order_line_items(purchase_order_id);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders
CREATE POLICY "Staff and above can view purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and above can insert purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and above can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can delete purchase orders"
  ON purchase_orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for purchase_order_line_items
CREATE POLICY "Staff and above can view PO line items"
  ON purchase_order_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and above can insert PO line items"
  ON purchase_order_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff and above can update PO line items"
  ON purchase_order_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'staff', 'mechanic', 'manager')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can delete PO line items"
  ON purchase_order_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Updated_at trigger for purchase_orders
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_orders_updated_at();
