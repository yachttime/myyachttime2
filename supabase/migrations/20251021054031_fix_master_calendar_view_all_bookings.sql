/*
  # Fix Master Calendar Access for Staff and Managers

  1. Changes
    - Update SELECT policy on yacht_bookings to allow staff and managers to view ALL bookings
    - This enables the master calendar to show all trips across all yachts
    
  2. Security
    - Staff and managers (is_staff() function) can view all bookings
    - Regular users can still only view their own bookings or bookings for yachts they have access to
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view bookings for their yacht" ON yacht_bookings;

-- Create new SELECT policy that allows staff/managers to view all bookings
CREATE POLICY "Users can view bookings for their yacht or staff can view all"
  ON yacht_bookings
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid()) 
    OR user_has_yacht_access(yacht_id)
    OR is_staff()
  );