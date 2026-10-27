/*
# Fix yacht budget saving for company users

1. Overview
- Restores the intended ability for authorized company users to create and manage yacht budgets.
- Automatically assigns a newly created budget to the signed-in user's active company when the client does not provide a company ID.

2. Modified Tables
- `yacht_budgets`
  - Adds a default for `company_id` using the existing `get_user_company_id()` helper.
  - Keeps all existing budget columns and data unchanged.

3. Security Changes
- Adds company-scoped INSERT access for authenticated users whose active company matches the budget company.
- Adds company-scoped UPDATE access for authenticated users whose active company matches the budget company.
- Adds company-scoped DELETE access for authenticated users whose active company matches the budget company.
- Existing master-user policies remain in place for master users.
- No access is granted across company boundaries.

4. Important Notes
- Existing rows are not modified or removed.
- The default only applies to future inserts where `company_id` is omitted.
- The migration is safe to re-run because policies are replaced by name and the column default is set idempotently.
*/

ALTER TABLE public.yacht_budgets
  ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();

DROP POLICY IF EXISTS "Company users can insert yacht budgets" ON public.yacht_budgets;
CREATE POLICY "Company users can insert yacht budgets"
  ON public.yacht_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Company users can update yacht budgets" ON public.yacht_budgets;
CREATE POLICY "Company users can update yacht budgets"
  ON public.yacht_budgets
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Company users can delete yacht budgets" ON public.yacht_budgets;
CREATE POLICY "Company users can delete yacht budgets"
  ON public.yacht_budgets
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());