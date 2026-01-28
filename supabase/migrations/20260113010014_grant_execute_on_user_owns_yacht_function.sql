/*
  # Grant Execute Permission on Helper Function

  1. Changes
    - Grant EXECUTE permission on user_owns_yacht function to authenticated users
    - This ensures the function can be called from RLS policies

  2. Security
    - Function is SECURITY DEFINER so it runs with elevated privileges
    - Only returns boolean, no data exposure risk
*/

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_owns_yacht(uuid, uuid) TO authenticated;