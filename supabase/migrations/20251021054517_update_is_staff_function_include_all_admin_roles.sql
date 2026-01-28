/*
  # Update is_staff Function to Include All Admin Roles

  1. Changes
    - Replace is_staff() function to check for 'staff', 'manager', and 'owner' roles
    - This allows all administrative users to access master calendar and other admin features
    
  2. Security
    - Function properly checks authenticated user's role
    - Enables proper access control for administrative features
*/

-- Create or replace the function (this will update it without dropping)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('staff', 'manager', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;