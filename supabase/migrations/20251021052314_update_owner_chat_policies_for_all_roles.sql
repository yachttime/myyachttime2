/*
  # Update Owner Chat Policies for All Roles

  1. Changes
    - Drop existing restrictive INSERT policy for owner_chat_messages
    - Create new INSERT policy allowing owners, staff, and mechanics to create messages
    - Drop existing restrictive SELECT policy for owner_chat_messages
    - Create new SELECT policy allowing all authenticated users to view messages
  
  2. Security
    - Staff and mechanics can now send check-in/check-out notifications
    - All authenticated users can view messages in the admin panel
    - Messages are still tied to specific yachts via yacht_id
  
  3. Notes
    - This change enables staff and mechanics to send automated notifications
    - Admins can view all messages in the new messages card
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Owners can create chat messages for their yacht" ON owner_chat_messages;
DROP POLICY IF EXISTS "Owners can view chat messages for their yacht" ON owner_chat_messages;

-- Allow authenticated users (owners, staff, mechanics) to create messages for yachts they're associated with
CREATE POLICY "Authenticated users can create chat messages"
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

-- Allow all authenticated users to view messages (needed for admin panel)
CREATE POLICY "Authenticated users can view chat messages"
  ON owner_chat_messages
  FOR SELECT
  TO authenticated
  USING (true);
