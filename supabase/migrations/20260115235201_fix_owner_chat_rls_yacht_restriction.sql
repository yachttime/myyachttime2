/*
  # Fix Owner Chat Messages RLS to Restrict by Yacht

  ## Summary
  Updates the SELECT policy for owner_chat_messages to ensure owners can only view
  messages for their assigned yacht. Staff and managers can view all messages.

  ## Changes Made
  - Drop existing permissive SELECT policy that allowed all authenticated users to view all messages
  - Create separate SELECT policies for owners vs staff/managers
  - Owner policy: requires yacht_id match (can only see messages for their assigned yacht)
  - Staff/Manager policy: allows viewing all messages for any yacht

  ## Security
  - Owners without a yacht assignment will see no messages (secure default)
  - Owners can only view messages for their assigned yacht
  - Staff and managers can view messages for any yacht (needed for support)
  - Prevents privacy leaks between different yacht owners

  ## Notes
  - This resolves the issue where Karen Stanley (no yacht assigned) could see OCEANUS messages
  - Maintains proper data isolation between different yacht owners
*/

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can view chat messages" ON owner_chat_messages;
DROP POLICY IF EXISTS "Owners can view chat messages for their yacht" ON owner_chat_messages;

-- Policy for regular owners: can only view messages for their assigned yacht
CREATE POLICY "Owners can view messages for their assigned yacht"
  ON owner_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = owner_chat_messages.yacht_id
    )
  );

-- Policy for staff and managers: can view all messages for any yacht
CREATE POLICY "Staff and managers can view all messages"
  ON owner_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );
