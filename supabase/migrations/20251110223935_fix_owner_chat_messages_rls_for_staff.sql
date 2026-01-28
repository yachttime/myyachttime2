/*
  # Fix Owner Chat Messages RLS for Staff and Manager Roles

  1. Overview
    - Fixes the crash when managers/staff approve repair requests with notes
    - Updates RLS policy to allow staff and managers to insert messages for any yacht
    - Maintains security by checking user roles instead of yacht_id match

  2. Changes
    - Drop existing restrictive INSERT policies on owner_chat_messages
    - Create separate policies for owners vs staff/managers
    - Owner policy: requires yacht_id match (existing behavior)
    - Staff/Manager policy: allows insert for any yacht if user has staff/manager role

  3. Security
    - Owners can only insert messages for their assigned yacht
    - Staff and managers can insert messages for any yacht (needed for repair approvals)
    - All authenticated users can still view messages
    - Maintains data integrity while fixing the approval flow crash

  4. Notes
    - This resolves the issue where approval with notes crashes to home screen
    - The crash was caused by RLS policy rejecting staff/manager inserts
    - Staff/managers often work across multiple yachts without yacht_id assignment
*/

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can create chat messages" ON owner_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can create messages for their yacht" ON owner_chat_messages;

-- Policy for regular owners: can only insert messages for their assigned yacht
CREATE POLICY "Owners can create messages for their yacht"
  ON owner_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = owner_chat_messages.yacht_id
    )
  );

-- Policy for staff and managers: can insert messages for any yacht
CREATE POLICY "Staff and managers can create messages for any yacht"
  ON owner_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );
