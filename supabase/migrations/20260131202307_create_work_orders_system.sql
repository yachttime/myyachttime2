/*
  # Create Work Orders System

  1. New Tables
    - `work_orders`
      - `id` (uuid, primary key)
      - `work_order_number` (text, unique) - Auto-generated work order number
      - `estimate_id` (uuid, foreign key) - Reference to estimate
      - `yacht_id` (uuid, nullable) - Reference to yacht if not retail
      - `customer_name` (text, nullable) - For retail customers
      - `customer_email` (text, nullable) - For retail customers
      - `customer_phone` (text, nullable) - For retail customers
      - `is_retail_customer` (boolean) - Whether this is a retail customer
      - `assigned_user_id` (uuid, nullable) - Primary assigned user
      - `status` (text) - pending, in_progress, completed, invoiced
      - `scheduled_date` (date, nullable) - When work is scheduled
      - `started_at` (timestamptz, nullable) - When work actually started
      - `completed_at` (timestamptz, nullable) - When work was completed
      - `completion_notes` (text, nullable) - Notes about completion
      - `total_hours_worked` (numeric) - Total hours tracked
      - `created_by` (uuid, foreign key) - Who created the work order
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `work_order_time_entries`
      - `id` (uuid, primary key)
      - `work_order_id` (uuid, foreign key) - Reference to work order
      - `user_id` (uuid, foreign key) - User who worked
      - `labor_code_id` (uuid, foreign key) - Type of work performed
      - `start_time` (timestamptz) - When they started
      - `end_time` (timestamptz, nullable) - When they ended
      - `hours_worked` (numeric) - Calculated hours
      - `notes` (text, nullable) - Notes about the work
      - `staff_time_entry_id` (uuid, nullable) - Link to payroll time entry
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for master users to manage work orders
*/

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text UNIQUE NOT NULL,
  estimate_id uuid REFERENCES estimates(id) NOT NULL,
  yacht_id uuid REFERENCES yachts(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  is_retail_customer boolean DEFAULT false NOT NULL,
  assigned_user_id uuid REFERENCES user_profiles(user_id),
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'invoiced')),
  scheduled_date date,
  started_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  total_hours_worked numeric(10, 2) DEFAULT 0 NOT NULL,
  created_by uuid REFERENCES user_profiles(user_id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT work_order_customer_check CHECK (
    (yacht_id IS NOT NULL AND is_retail_customer = false) OR
    (customer_name IS NOT NULL AND is_retail_customer = true)
  )
);

CREATE TABLE IF NOT EXISTS work_order_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(user_id) NOT NULL,
  labor_code_id uuid REFERENCES labor_codes(id) NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  hours_worked numeric(10, 2) DEFAULT 0 NOT NULL,
  notes text,
  staff_time_entry_id uuid REFERENCES staff_time_entries(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_estimate_id ON work_orders(estimate_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_yacht_id ON work_orders(yacht_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_user ON work_orders(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_order_time_entries_work_order ON work_order_time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_time_entries_user ON work_order_time_entries(user_id);

-- Enable RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_time_entries ENABLE ROW LEVEL SECURITY;

-- Master users can manage work orders
CREATE POLICY "Master users can view work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can insert work orders"
  ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can update work orders"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can delete work orders"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Master users can manage work order time entries
CREATE POLICY "Master users can view work order time entries"
  ON work_order_time_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can insert work order time entries"
  ON work_order_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can update work order time entries"
  ON work_order_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can delete work order time entries"
  ON work_order_time_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();

-- Function to generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 3) AS integer)), 0) + 1
  INTO next_num
  FROM work_orders
  WHERE work_order_number ~ '^WO[0-9]+$';
  
  new_number := 'WO' || LPAD(next_num::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;