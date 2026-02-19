/*
  # Fix Repair Requests Visibility When company_id is NULL

  ## Problem
  Repair requests created from the Estimating system have company_id = NULL
  because the estimates table has no company_id populated. The existing RLS
  SELECT policy "Users can view company repair requests" requires company_id
  to match, so these records are invisible to everyone.

  ## Changes
  1. Update "Users can view company repair requests" SELECT policy to also
     show records where submitted_by = auth.uid() OR company_id IS NULL
     (for backwards compatibility with existing data)
  2. Update INSERT policy to allow inserts where company_id IS NULL as long
     as submitted_by = auth.uid()
  3. Backfill company_id on existing repair_requests that have estimate_id
     by looking up the company from the submitting user's profile
*/

-- Fix the SELECT policy to include records with null company_id or submitted by current user
DROP POLICY IF EXISTS "Users can view company repair requests" ON repair_requests;

CREATE POLICY "Users can view company repair requests"
  ON repair_requests FOR SELECT
  TO authenticated
  USING (
    is_master_user()
    OR (company_id IS NOT NULL AND company_id = get_user_company_id())
    OR (company_id IS NULL)
    OR (submitted_by = auth.uid())
  );

-- Fix INSERT policy to allow null company_id when submitted_by matches
DROP POLICY IF EXISTS "Users can insert company repair requests" ON repair_requests;

CREATE POLICY "Users can insert company repair requests"
  ON repair_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_user()
    OR (company_id IS NOT NULL AND company_id = get_user_company_id())
    OR (company_id IS NULL AND submitted_by = auth.uid())
  );

-- Backfill company_id on repair_requests from submitting user's profile
UPDATE repair_requests rr
SET company_id = up.company_id
FROM user_profiles up
WHERE rr.submitted_by = up.user_id
  AND rr.company_id IS NULL
  AND up.company_id IS NOT NULL;
