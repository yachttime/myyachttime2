/*
  # Fix Master Role Company Assignment

  1. Changes
    - Drop the old constraint that prevented master users from having a company_id
    - This allows master users to be properly assigned to companies for QuickBooks integration
  
  2. Security
    - No RLS changes needed
*/

-- Drop the constraint that prevents masters from having a company_id
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_company_role_check;
