/*
  # Create Owner Chat Messages Table

  1. New Tables
    - `owner_chat_messages`
      - `id` (uuid, primary key)
      - `yacht_id` (uuid, foreign key to yachts)
      - `user_id` (uuid, foreign key to auth.users)
      - `message` (text, required) - The chat message content
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `owner_chat_messages` table
    - Add policy for owners to create messages for their yacht
    - Add policy for owners to view all messages for their yacht
  
  3. Notes
    - This table enables yacht owners to communicate with each other
    - All owners of the same yacht can see all messages
    - Messages are ordered by creation time for chat display
*/

CREATE TABLE IF NOT EXISTS owner_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE owner_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can create chat messages for their yacht"
  ON owner_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = owner_chat_messages.yacht_id
      AND user_profiles.role = 'owner'
    )
  );

CREATE POLICY "Owners can view chat messages for their yacht"
  ON owner_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = owner_chat_messages.yacht_id
      AND user_profiles.role = 'owner'
    )
  );

CREATE INDEX IF NOT EXISTS idx_owner_chat_messages_yacht_id ON owner_chat_messages(yacht_id);
CREATE INDEX IF NOT EXISTS idx_owner_chat_messages_created_at ON owner_chat_messages(created_at);