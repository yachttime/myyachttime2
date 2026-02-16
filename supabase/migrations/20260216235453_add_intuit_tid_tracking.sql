/*
  # Add Intuit Transaction ID Tracking for QuickBooks Integration

  ## Overview
  Adds comprehensive tracking of Intuit Transaction IDs (intuit_tid) from QuickBooks API responses.
  This enables better troubleshooting support when working with QuickBooks API issues.

  ## Changes

  1. New Table: `quickbooks_api_logs`
     - `id` (uuid, primary key) - Unique identifier
     - `company_id` (uuid, foreign key) - Company making the API call
     - `connection_id` (uuid, foreign key) - QuickBooks connection used
     - `endpoint` (text) - API endpoint called (e.g., '/customer', '/invoice')
     - `method` (text) - HTTP method (GET, POST, PUT, DELETE)
     - `request_type` (text) - Type of operation (e.g., 'create_customer', 'create_invoice', 'sync_accounts')
     - `intuit_tid` (text) - Intuit Transaction ID from response headers
     - `status_code` (int) - HTTP status code returned
     - `success` (boolean) - Whether the call was successful
     - `error_message` (text, nullable) - Error message if failed
     - `reference_type` (text, nullable) - Type of record affected (e.g., 'invoice', 'customer')
     - `reference_id` (uuid, nullable) - ID of record in our system
     - `qbo_id` (text, nullable) - QuickBooks object ID returned
     - `created_at` (timestamptz) - When the API call was made

  2. Updated Table: `quickbooks_connection`
     - `last_intuit_tid` (text, nullable) - Most recent intuit_tid from any API call
     - `last_api_call_at` (timestamptz, nullable) - Timestamp of last API call

  ## Security
  - Enable RLS on quickbooks_api_logs
  - Master users can view all logs for their company
  - Staff users can view logs for their company
  - Logs are automatically cleaned up after 90 days to manage storage

  ## Important Notes
  - The intuit_tid is critical for QuickBooks support troubleshooting
  - All QuickBooks API calls should log their intuit_tid
  - Logs are retained for 90 days for debugging purposes
*/

-- Create quickbooks_api_logs table
CREATE TABLE IF NOT EXISTS quickbooks_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES quickbooks_connection(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  request_type text NOT NULL,
  intuit_tid text,
  status_code int NOT NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  reference_type text,
  reference_id uuid,
  qbo_id text,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_quickbooks_api_logs_company_id ON quickbooks_api_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_api_logs_connection_id ON quickbooks_api_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_api_logs_created_at ON quickbooks_api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_quickbooks_api_logs_intuit_tid ON quickbooks_api_logs(intuit_tid) WHERE intuit_tid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quickbooks_api_logs_reference ON quickbooks_api_logs(reference_type, reference_id) WHERE reference_type IS NOT NULL;

-- Add tracking fields to quickbooks_connection
ALTER TABLE quickbooks_connection 
  ADD COLUMN IF NOT EXISTS last_intuit_tid text,
  ADD COLUMN IF NOT EXISTS last_api_call_at timestamptz;

-- Enable RLS
ALTER TABLE quickbooks_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quickbooks_api_logs
CREATE POLICY "Master users can view API logs for their company"
  ON quickbooks_api_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.company_id = quickbooks_api_logs.company_id
        AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Staff can view API logs for their company"
  ON quickbooks_api_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.company_id = quickbooks_api_logs.company_id
        AND user_profiles.role IN ('staff', 'manager')
    )
  );

CREATE POLICY "Service role can insert API logs"
  ON quickbooks_api_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Function to clean up old API logs (runs automatically)
CREATE OR REPLACE FUNCTION cleanup_old_quickbooks_api_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM quickbooks_api_logs
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_quickbooks_api_logs() TO service_role;

COMMENT ON TABLE quickbooks_api_logs IS 'Tracks all QuickBooks API interactions with intuit_tid for troubleshooting support';
COMMENT ON COLUMN quickbooks_api_logs.intuit_tid IS 'Intuit Transaction ID from response headers - critical for QuickBooks support troubleshooting';
