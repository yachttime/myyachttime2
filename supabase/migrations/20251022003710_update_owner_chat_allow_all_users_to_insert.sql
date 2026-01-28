/*
  # Update Owner Chat Messages RLS Policies

  1. Changes
    - Drop the restrictive insert policy that only allows owners
    - Create a new policy that allows any authenticated user to insert messages
    - This enables users to create check-in/check-out alert messages
    - Admins will see these messages in the "New Messages" section

  2. Security
    - Users can only insert messages for their assigned yacht
    - All authenticated users can create messages (not just owners)
    - View policies remain unchanged (staff can view all messages)
*/

DROP POLICY IF EXISTS "Owners can create chat messages for their yacht" ON owner_chat_messages;

CREATE POLICY "Authenticated users can create messages for their yacht"
  ON owner_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = owner_chat_messages.yacht_id
    )
  );
