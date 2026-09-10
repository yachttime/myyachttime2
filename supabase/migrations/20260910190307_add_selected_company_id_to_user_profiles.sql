-- Add selected_company_id column to user_profiles for master company switching
-- When a master selects a different company, this field is set and get_user_company_id() returns it
-- For non-masters, this is always null and their real company_id is used
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS selected_company_id uuid;

-- Update get_user_company_id() to return the selected company for masters
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT COALESCE(
  (SELECT selected_company_id FROM user_profiles WHERE user_id = auth.uid() AND role = 'master' AND selected_company_id IS NOT NULL LIMIT 1),
  (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
);
$function$;

-- Drop the set_selected_company function since we now use the column approach
DROP FUNCTION IF EXISTS public.set_selected_company(uuid);

-- Allow masters to update their own selected_company_id
-- This is intentionally separate from the general user_profiles update policies
CREATE POLICY "Masters can update own selected_company_id"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master'
  ))
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master'
  ));
