/*
  # Add INSERT Policy to Approval Tokens

  1. Changes
    - Add INSERT policy to `repair_request_approval_tokens` table
    - Allow staff, master, mechanic, and manager roles to create approval tokens
    - This enables sending repair estimate emails with approval links

  2. Security
    - Only staff members can create approval tokens
    - Tokens are created when sending repair estimate emails
*/

-- Allow staff, master, mechanic, and manager to create approval tokens
CREATE POLICY "Allow staff to create approval tokens"
  ON repair_request_approval_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master', 'mechanic', 'manager')
    )
  );
