/*
  # Create Yacht Invoices Table

  1. Overview
    - Creates a dedicated table to track all invoices sent to yacht managers
    - Stores copies of invoice data from completed repair requests
    - Enables invoice tracking with year-based filtering and running totals
    - Provides historical record of all yacht-related billing

  2. New Tables
    - `yacht_invoices`
      - `id` (uuid, primary key) - Unique invoice identifier
      - `yacht_id` (uuid, foreign key) - Reference to yachts table
      - `repair_request_id` (uuid, foreign key) - Reference to originating repair request
      - `invoice_amount` (text) - Invoice amount as entered (e.g., "$1,500.00")
      - `invoice_amount_numeric` (numeric) - Parsed numeric value for calculations
      - `invoice_file_url` (text) - URL to invoice PDF attachment
      - `invoice_file_name` (text) - Original filename of invoice attachment
      - `repair_title` (text) - Title of the repair request
      - `invoice_year` (integer) - Year of invoice for filtering
      - `invoice_date` (timestamptz) - Date invoice was created
      - `completed_by` (uuid) - User who completed the repair
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  3. Security
    - Enable RLS on yacht_invoices table
    - Allow managers to view invoices for their assigned yacht
    - Allow staff to view and insert all invoices
    - Restrict delete operations to staff only

  4. Indexes
    - Index on yacht_id for efficient yacht-based queries
    - Index on invoice_year for year filtering
    - Composite index on yacht_id and invoice_year for combined filtering
*/

-- Create yacht_invoices table
CREATE TABLE IF NOT EXISTS yacht_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  repair_request_id uuid REFERENCES repair_requests(id) ON DELETE SET NULL,
  invoice_amount text NOT NULL,
  invoice_amount_numeric numeric(10,2),
  invoice_file_url text,
  invoice_file_name text,
  repair_title text NOT NULL,
  invoice_year integer NOT NULL,
  invoice_date timestamptz DEFAULT now(),
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_yacht_id ON yacht_invoices(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_year ON yacht_invoices(invoice_year);
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_yacht_year ON yacht_invoices(yacht_id, invoice_year);

-- Enable Row Level Security
ALTER TABLE yacht_invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can view invoices for their assigned yacht
CREATE POLICY "Managers can view own yacht invoices"
  ON yacht_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'manager'
      AND user_profiles.yacht_id = yacht_invoices.yacht_id
    )
  );

-- Policy: Staff can view all invoices
CREATE POLICY "Staff can view all invoices"
  ON yacht_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- Policy: Staff can insert invoices
CREATE POLICY "Staff can insert invoices"
  ON yacht_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- Policy: Staff can update invoices
CREATE POLICY "Staff can update invoices"
  ON yacht_invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );

-- Policy: Staff can delete invoices
CREATE POLICY "Staff can delete invoices"
  ON yacht_invoices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'staff'
    )
  );
