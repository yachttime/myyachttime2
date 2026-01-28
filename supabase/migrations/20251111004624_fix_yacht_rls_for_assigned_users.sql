/*
  # Fix Yacht RLS to Allow Assigned Users

  1. Changes
    - Update the yacht SELECT policy to allow users to see yachts they're assigned to via user_profiles.yacht_id
    - This fixes the issue where owners with assigned yachts couldn't see their yacht data
  
  2. Security
    - Users can view yachts if they are:
      - Staff/Manager (via is_staff function)
      - The yacht owner (via owner_id)
      - Assigned to the yacht (via user_profiles.yacht_id)
*/

DROP POLICY IF EXISTS "Staff can view all yachts" ON yachts;

CREATE POLICY "Users can view accessible yachts"
  ON yachts
  FOR SELECT
  TO authenticated
  USING (
    is_staff(auth.uid()) 
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = yachts.id
    )
  );
