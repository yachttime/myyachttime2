/*
  # Add Retail Customer Support to Repair Requests

  1. Changes to `repair_requests` table
    - Add `customer_name` (text) - Name of retail customer
    - Add `customer_phone` (text) - Phone number of retail customer
    - Add `customer_email` (text) - Email address of retail customer
    - Make `yacht_id` nullable to support retail customers
    - Add `is_retail_customer` (boolean) - Flag to indicate retail customer requests

  2. Data Integrity
    - Add check constraint to ensure either yacht_id OR all customer fields are provided
    - Maintain existing foreign key constraints

  3. Security
    - Update RLS policies to allow staff/managers to view retail customer requests
    - Ensure retail customer data is properly secured
*/

-- Add retail customer fields to repair_requests table
DO $$
BEGIN
  -- Add customer_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN customer_name text;
  END IF;

  -- Add customer_phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN customer_phone text;
  END IF;

  -- Add customer_email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN customer_email text;
  END IF;

  -- Add is_retail_customer flag if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'is_retail_customer'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN is_retail_customer boolean DEFAULT false;
  END IF;
END $$;

-- Make yacht_id nullable to support retail customers
ALTER TABLE repair_requests ALTER COLUMN yacht_id DROP NOT NULL;

-- Add check constraint to ensure either yacht_id OR all customer fields are provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_requests_customer_type_check'
  ) THEN
    ALTER TABLE repair_requests ADD CONSTRAINT repair_requests_customer_type_check
    CHECK (
      (yacht_id IS NOT NULL AND is_retail_customer = false) OR
      (yacht_id IS NULL AND is_retail_customer = true AND
       customer_name IS NOT NULL AND customer_phone IS NOT NULL AND customer_email IS NOT NULL)
    );
  END IF;
END $$;

-- Create policy for staff/managers to view retail customer repair requests
CREATE POLICY "Staff can view retail customer repair requests"
  ON repair_requests
  FOR SELECT
  TO authenticated
  USING (
    is_retail_customer = true AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

-- Create policy for staff/managers to update retail customer repair requests
CREATE POLICY "Staff can update retail customer repair requests"
  ON repair_requests
  FOR UPDATE
  TO authenticated
  USING (
    is_retail_customer = true AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  )
  WITH CHECK (
    is_retail_customer = true AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

-- Add index for retail customer requests
CREATE INDEX IF NOT EXISTS idx_repair_requests_is_retail ON repair_requests(is_retail_customer);
