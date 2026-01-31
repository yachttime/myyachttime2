/*
  # Add Master and Staff Access to Yachts Table

  1. Problem
    - Yachts table only has policy for anonymous users
    - Authenticated users (including master) cannot see any yachts
    
  2. Solution
    - Add policy for master role to see ALL yachts
    - Add policy for staff/manager/mechanic to see ALL yachts
    - Add policy for owners to see their assigned yacht
    
  3. Security
    - Master: Unrestricted access to all yachts
    - Staff/Manager/Mechanic: Can view all yachts
    - Owners: Can only view their assigned yacht
*/

-- Add policy for authenticated users to view yachts
CREATE POLICY "Authenticated users can view yachts"
  ON public.yachts
  FOR SELECT
  TO authenticated
  USING (
    -- Master can see all yachts
    is_master()
    OR
    -- Staff/Manager/Mechanic can see all yachts
    is_staff()
    OR
    -- Owners can see their assigned yacht
    id IN (
      SELECT yacht_id 
      FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND yacht_id IS NOT NULL
    )
  );

-- Add policy for master to insert yachts
CREATE POLICY "Master can insert yachts"
  ON public.yachts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_master());

-- Add policy for master to update yachts
CREATE POLICY "Master can update yachts"
  ON public.yachts
  FOR UPDATE
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- Add policy for master to delete yachts
CREATE POLICY "Master can delete yachts"
  ON public.yachts
  FOR DELETE
  TO authenticated
  USING (is_master());
