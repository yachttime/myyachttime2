/*
  # Add Company Architecture to User Profiles

  1. Changes to user_profiles
    - Add `company_id` column (nullable for master users)
    - Master users have company_id = NULL (global access)
    - Regular users must have company_id set (assigned to a company)
    - Add constraint to enforce this rule
    - Add index on company_id for performance

  2. Data Migration
    - Get AZ Marine company ID
    - Set all existing non-master users to AZ Marine company
    - Keep master users with NULL company_id

  3. Notes
    - Master users are global and can manage all companies
    - Regular users (staff, admin, captain, mechanic) belong to one company
*/

-- Add company_id column to user_profiles (nullable for masters)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- Create index on company_id for fast filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);

-- Migrate existing users to AZ Marine company (except masters)
DO $$
DECLARE
  az_marine_id uuid;
BEGIN
  -- Get AZ Marine company ID
  SELECT id INTO az_marine_id FROM companies WHERE company_name = 'AZ Marine' LIMIT 1;
  
  IF az_marine_id IS NOT NULL THEN
    -- Update all non-master users to belong to AZ Marine
    UPDATE user_profiles
    SET company_id = az_marine_id
    WHERE role != 'master' AND company_id IS NULL;
    
    -- Keep master users with NULL company_id (they are global)
    UPDATE user_profiles
    SET company_id = NULL
    WHERE role = 'master';
    
    RAISE NOTICE 'Migrated users to AZ Marine company (ID: %)', az_marine_id;
  ELSE
    RAISE EXCEPTION 'AZ Marine company not found - cannot migrate users';
  END IF;
END $$;

-- Add constraint: masters must have NULL company_id, others must have a company_id
-- This will be enforced going forward (existing data already migrated above)
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_company_role_check
CHECK (
  (role = 'master' AND company_id IS NULL) OR 
  (role != 'master' AND company_id IS NOT NULL)
);

-- Add comment explaining the architecture
COMMENT ON COLUMN user_profiles.company_id IS 
  'Company ID for regular users (staff, admin, captain, mechanic). NULL for master users who have global access.';
