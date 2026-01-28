/*
  # Add Billing Fields to Repair Requests

  1. Overview
    - Adds estimated repair cost and final invoice fields to repair_requests table
    - Adds invoice PDF file storage support
    - Enables billing workflow for repair requests

  2. New Columns
    - `estimated_repair_cost` (text) - Estimated cost entered when creating request
    - `final_invoice_amount` (text) - Final invoice amount entered when billing
    - `invoice_file_url` (text) - URL to uploaded invoice PDF
    - `invoice_file_name` (text) - Original invoice file name
    - `billed_at` (timestamptz) - Timestamp when invoice was sent to manager
    - `billed_by` (uuid) - User who sent the invoice

  3. Security
    - Existing RLS policies apply to new columns
    - No additional policies needed
*/

-- Add billing fields to repair_requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'estimated_repair_cost'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN estimated_repair_cost text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'final_invoice_amount'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN final_invoice_amount text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'invoice_file_url'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN invoice_file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'invoice_file_name'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN invoice_file_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'billed_at'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN billed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'billed_by'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN billed_by uuid REFERENCES auth.users(id);
  END IF;
END $$;
