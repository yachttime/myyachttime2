/*
  # Create Customer Database System

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `customer_type` (text: 'individual' or 'business')
      - `first_name` (text, for individuals)
      - `last_name` (text, for individuals)
      - `business_name` (text, for businesses)
      - `email` (text, nullable)
      - `phone` (text, nullable)
      - `secondary_phone` (text, nullable)
      - `address_line1` (text, nullable)
      - `address_line2` (text, nullable)
      - `city` (text, nullable)
      - `state` (text, nullable)
      - `zip_code` (text, nullable)
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)
      - `created_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `customer_vessels`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `vessel_name` (text)
      - `manufacturer` (text, nullable)
      - `model` (text, nullable)
      - `year` (integer, nullable)
      - `length_feet` (integer, nullable)
      - `hull_number` (text, nullable)
      - `registration_number` (text, nullable)
      - `engine_make` (text, nullable)
      - `engine_model` (text, nullable)
      - `fuel_type` (text, nullable)
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `customer_id` to `estimates`
    - Add `customer_id` and `vessel_id` to `work_orders`
    - Add `customer_id` to `yacht_invoices`
    - Add `customer_id` and `vessel_id` to `repair_requests`

  3. Security
    - Enable RLS on all new tables
    - Grant staff/mechanic/master/manager full access to customers and vessels
    - Customers are shared across all users (not yacht-specific)
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type text NOT NULL CHECK (customer_type IN ('individual', 'business')),
  first_name text,
  last_name text,
  business_name text,
  email text,
  phone text,
  secondary_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  notes text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(user_id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT customer_name_check CHECK (
    (customer_type = 'individual' AND first_name IS NOT NULL AND last_name IS NOT NULL) OR
    (customer_type = 'business' AND business_name IS NOT NULL)
  )
);

-- Create customer_vessels table
CREATE TABLE IF NOT EXISTS customer_vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vessel_name text NOT NULL,
  manufacturer text,
  model text,
  year integer,
  length_feet integer,
  hull_number text,
  registration_number text,
  engine_make text,
  engine_model text,
  fuel_type text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON customers(last_name) WHERE last_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON customers(business_name) WHERE business_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_vessels_customer_id ON customer_vessels(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_vessels_hull_number ON customer_vessels(hull_number) WHERE hull_number IS NOT NULL;

-- Add customer_id to estimates
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Add customer_id and vessel_id to work_orders
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS vessel_id uuid REFERENCES customer_vessels(id);

-- Add customer_id to yacht_invoices (for retail customers)
ALTER TABLE yacht_invoices 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Add customer_id and vessel_id to repair_requests
ALTER TABLE repair_requests 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS vessel_id uuid REFERENCES customer_vessels(id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vessels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
CREATE POLICY "Staff can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

-- RLS Policies for customer_vessels table
CREATE POLICY "Staff can view all customer vessels"
  ON customer_vessels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff can insert customer vessels"
  ON customer_vessels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff can update customer vessels"
  ON customer_vessels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Staff can delete customer vessels"
  ON customer_vessels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

-- Create helper function to get customer display name
CREATE OR REPLACE FUNCTION get_customer_display_name(customer_row customers)
RETURNS text AS $$
BEGIN
  IF customer_row.customer_type = 'business' THEN
    RETURN customer_row.business_name;
  ELSE
    RETURN customer_row.first_name || ' ' || customer_row.last_name;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

CREATE TRIGGER customer_vessels_updated_at
  BEFORE UPDATE ON customer_vessels
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();
