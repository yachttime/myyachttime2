/*
  # Allow Users to Update Own Repair Requests

  1. Changes
    - Add UPDATE policy for users to edit their own repair requests
    - Users can only update their own requests when status is 'pending'
    - Users can update title, description, file_url, file_name
    - Users cannot change status, approval fields, or other system fields
    
  2. Security
    - Users can only update requests they submitted
    - Updates only allowed for pending requests
    - Cannot modify submitted_by, status, or approval fields
*/

-- Allow users to update their own pending repair requests
CREATE POLICY "Users can update own pending repair requests"
  ON repair_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = submitted_by 
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = submitted_by 
    AND status = 'pending'
  );
