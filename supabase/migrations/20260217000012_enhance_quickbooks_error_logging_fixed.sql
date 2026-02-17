/*
  # Enhance QuickBooks Error Logging for Comprehensive Troubleshooting

  ## Overview
  Enhances the quickbooks_api_logs table to capture complete error details
  that can be shared with QuickBooks support for faster issue resolution.

  ## Changes

  1. Updated Table: `quickbooks_api_logs`
     - `request_body` (jsonb, nullable) - Full request payload sent to QuickBooks
     - `response_body` (jsonb, nullable) - Full response received from QuickBooks
     - `response_headers` (jsonb, nullable) - All response headers including intuit_tid
     - `duration_ms` (int, nullable) - API call duration in milliseconds
     - `user_agent` (text, nullable) - User agent making the request
     - `ip_address` (text, nullable) - IP address of requester

  ## Important Notes
  - Comprehensive logs help QuickBooks support diagnose issues faster
  - Request/response bodies stored as JSONB for easy querying
  - Logs are automatically cleaned up after 90 days
*/

-- Add comprehensive error logging fields
ALTER TABLE quickbooks_api_logs
  ADD COLUMN IF NOT EXISTS request_body jsonb,
  ADD COLUMN IF NOT EXISTS response_body jsonb,
  ADD COLUMN IF NOT EXISTS response_headers jsonb,
  ADD COLUMN IF NOT EXISTS duration_ms int,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_address text;

-- Create index for efficient error queries
CREATE INDEX IF NOT EXISTS idx_quickbooks_api_logs_error_lookup 
  ON quickbooks_api_logs(company_id, success, created_at DESC) 
  WHERE success = false;

COMMENT ON COLUMN quickbooks_api_logs.request_body IS 'Full request payload for troubleshooting - sensitive data should be redacted';
COMMENT ON COLUMN quickbooks_api_logs.response_body IS 'Complete error response from QuickBooks API';
COMMENT ON COLUMN quickbooks_api_logs.response_headers IS 'All response headers including intuit_tid for support escalation';
COMMENT ON COLUMN quickbooks_api_logs.duration_ms IS 'API call duration in milliseconds for performance monitoring';
