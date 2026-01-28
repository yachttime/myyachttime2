/*
  # Update is_staff Function to Include Manager Role

  1. Changes
    - Update is_staff(user_uuid) function to check for 'staff', 'manager', 'mechanic', and 'admin' roles
    - This ensures managers can access yachts and other staff-level features
    
  2. Security
    - Function properly checks authenticated user's role
    - Enables proper access control for administrative features
*/

-- Update the is_staff function with user_uuid parameter
CREATE OR REPLACE FUNCTION is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = user_uuid AND role IN ('staff', 'manager', 'mechanic', 'admin')
  );
END;
$$;