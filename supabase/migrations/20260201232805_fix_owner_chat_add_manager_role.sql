/*
  # Fix Owner Chat Messages RLS - Add Manager Role

  ## Summary
  Updates the SELECT policy for owner_chat_messages to include 'manager' role
  so that managers can view all chat messages alongside staff, mechanic, and master.

  ## Changes Made
  - Drop existing "Staff can view all chat messages" policy
  - Recreate with all four staff roles: staff, manager, mechanic, master

  ## Security
  - Staff, managers, mechanics, and master can view all messages for any yacht
  - Maintains existing security for owners (yacht-restricted)
*/

-- Drop existing staff policy
DROP POLICY IF EXISTS "Staff can view all chat messages" ON owner_chat_messages;

-- Recreate with manager role included
CREATE POLICY "Staff can view all chat messages"
  ON owner_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic', 'master')
    )
  );
