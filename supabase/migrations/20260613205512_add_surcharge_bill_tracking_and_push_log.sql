-- Add QB bill tracking columns to estimating_invoices
ALTER TABLE estimating_invoices
  ADD COLUMN IF NOT EXISTS qb_surcharge_bill_id TEXT,
  ADD COLUMN IF NOT EXISTS qb_surcharge_bill_date TIMESTAMPTZ;

-- Month-level push lock table
CREATE TABLE IF NOT EXISTS qb_surcharge_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM format
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pushed_by_user_id UUID NOT NULL REFERENCES user_profiles(user_id),
  invoice_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(company_id, month)
);

ALTER TABLE qb_surcharge_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_staff_select_push_log" ON qb_surcharge_push_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('master', 'staff', 'manager')
        AND (up.company_id = qb_surcharge_push_log.company_id OR up.role = 'master')
    )
  );

CREATE POLICY "master_staff_insert_push_log" ON qb_surcharge_push_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('master', 'staff', 'manager')
        AND (up.company_id = qb_surcharge_push_log.company_id OR up.role = 'master')
    )
  );
