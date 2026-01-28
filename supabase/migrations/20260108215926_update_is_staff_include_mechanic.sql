/*
  # Update is_staff Function to Include Mechanic Role

  ## Summary
  Updates the is_staff() function (no parameters) to include 'mechanic' role alongside
  'staff', 'manager', and 'owner' roles. This ensures all staff members have proper
  access to smart devices and other staff-level features.

  ## Changes Made
  - Updated is_staff() function to check for 'staff', 'manager', 'mechanic', and 'owner' roles

  ## Security
  Function properly checks authenticated user's role and enables proper access control
  for administrative and staff features.
*/

-- Update the is_staff function to include mechanic role
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('staff', 'manager', 'mechanic', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the version with parameter to ensure consistency
CREATE OR REPLACE FUNCTION is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = user_uuid AND role IN ('staff', 'manager', 'mechanic', 'owner')
  );
END;
$$;