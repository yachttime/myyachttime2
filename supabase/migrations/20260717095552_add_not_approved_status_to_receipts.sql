/*
# Add "not_approved" status to receipts for payroll deduction tracking

1. Modified Tables
   - `receipts` - updates status check constraint to include 'not_approved'
   - Adds `payroll_deduction` boolean column (default false) to flag receipts for payroll deduction

2. Important Notes
   - When staff/master marks a receipt as "Not Approved", status changes to 'not_approved'
     and payroll_deduction is set to true
   - This replaces the previous delete workflow for managers
*/

-- Drop old constraint and add new one with 'not_approved' included
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_status_check;
ALTER TABLE receipts ADD CONSTRAINT receipts_status_check CHECK (status IN ('pending', 'approved', 'archived', 'not_approved'));

-- Add payroll_deduction flag
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'payroll_deduction') THEN
    ALTER TABLE receipts ADD COLUMN payroll_deduction boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_receipts_payroll_deduction ON receipts(payroll_deduction) WHERE payroll_deduction = true;
