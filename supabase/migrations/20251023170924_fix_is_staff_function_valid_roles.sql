/*
  # Fix is_staff Function to Use Valid Roles

  1. Changes
    - Update is_staff(user_uuid) function to check for valid roles: 'staff', 'manager', 'mechanic'
    - This ensures managers and mechanics can access yachts and other staff-level features
    
  2. Security
    - Function properly checks authenticated user's role
    - Enables proper access control for administrative features
*/

-- Update the is_staff function with user_uuid parameter to use only valid roles
CREATE OR REPLACE FUNCTION is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = user_uuid AND role IN ('staff', 'manager', 'mechanic')
  );
END;
$$;