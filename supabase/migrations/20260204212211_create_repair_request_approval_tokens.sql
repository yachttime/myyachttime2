/*
  # Create Repair Request Approval Tokens

  1. New Tables
    - `repair_request_approval_tokens`
      - `id` (uuid, primary key)
      - `repair_request_id` (uuid, foreign key to repair_requests)
      - `token` (text, unique) - Secure random token for approval/denial link
      - `action_type` (text) - 'approve' or 'deny'
      - `manager_email` (text) - Email of the manager who received this token
      - `expires_at` (timestamptz) - Token expiration (24 hours from creation)
      - `used_at` (timestamptz, nullable) - When the token was used
      - `created_at` (timestamptz) - When the token was created

  2. Security
    - Enable RLS on `repair_request_approval_tokens` table
    - Allow anonymous users to read tokens (for validation)
    - Only staff/master can view all tokens for auditing
    - Tokens expire after 24 hours for security

  3. Indexes
    - Index on token for fast lookup
    - Index on repair_request_id for querying tokens by request
*/

-- Create repair request approval tokens table
CREATE TABLE IF NOT EXISTS repair_request_approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('approve', 'deny')),
  manager_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_repair_approval_tokens_token ON repair_request_approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_repair_approval_tokens_repair_request ON repair_request_approval_tokens(repair_request_id);
CREATE INDEX IF NOT EXISTS idx_repair_approval_tokens_expires ON repair_request_approval_tokens(expires_at);

-- Enable RLS
ALTER TABLE repair_request_approval_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read tokens (needed for validation when clicking email links)
CREATE POLICY "Allow anonymous to read unexpired tokens"
  ON repair_request_approval_tokens
  FOR SELECT
  TO anon
  USING (expires_at > now() AND used_at IS NULL);

-- Allow staff and master to view all tokens for auditing
CREATE POLICY "Allow staff and master to view all tokens"
  ON repair_request_approval_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );