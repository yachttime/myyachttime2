/*
  # Update user_has_yacht_access Function to Include Manager and Mechanic Roles

  1. Changes
    - Update user_has_yacht_access function to check for 'staff', 'manager', and 'mechanic' roles
    - This ensures managers and mechanics can access yacht bookings and related data
    
  2. Security
    - Function properly checks authenticated user's role and yacht access
    - Enables proper access control for administrative features
*/

-- Update the user_has_yacht_access function to include manager and mechanic roles
CREATE OR REPLACE FUNCTION user_has_yacht_access(yacht_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND (
      role IN ('staff', 'manager', 'mechanic')
      OR yacht_id = yacht_uuid
      OR yacht_uuid IN (SELECT id FROM yachts WHERE owner_id = auth.uid())
    )
  );
$$;