/*
  # Fix Yacht RLS - Allow Manager Role

  1. Changes
    - Update the "Master users can view all yachts" policy to include 'manager' role
    - This allows managers to view yacht information, which is needed for:
      - Enriching notification data with yacht names
      - Displaying yacht details in the dashboard
      - General yacht information access
  
  2. Security
    - Managers should be able to view yacht data
    - Frontend code filters managers to only their assigned yacht's data
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Master users can view all yachts" ON yachts;

-- Recreate with manager role included
CREATE POLICY "Master users can view all yachts"
  ON yachts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'owner', 'staff', 'mechanic', 'manager')
    )
  );
