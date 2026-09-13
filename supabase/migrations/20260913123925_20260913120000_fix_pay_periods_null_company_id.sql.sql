-- Backfill NULL company_id on pay_periods to AZ Marine
UPDATE pay_periods
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

-- Backfill NULL company_id on staff_time_entries to AZ Marine
UPDATE staff_time_entries
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE company_id IS NULL;

-- Update the pay_periods SELECT policy to also allow rows with NULL company_id
-- (safety net so legacy rows don't disappear if any remain)
DROP POLICY IF EXISTS "Users can view company pay periods" ON pay_periods;
CREATE POLICY "Users can view company pay periods" ON pay_periods
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR company_id IS NULL);
