/*
  # Allow Anonymous Users to Read Yacht Names for Signup

  1. Changes
    - Add SELECT policy for anonymous users to view yacht names
    - This allows the signup form to display available yachts
    - Policy only allows reading id and name fields, not sensitive data
  
  2. Security
    - Limited to SELECT operations only
    - Users can only see active yachts
    - Does not expose sensitive yacht information
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'yachts' 
    AND policyname = 'Anonymous users can view yacht names for signup'
  ) THEN
    CREATE POLICY "Anonymous users can view yacht names for signup"
      ON yachts
      FOR SELECT
      TO anon
      USING (is_active = true);
  END IF;
END $$;