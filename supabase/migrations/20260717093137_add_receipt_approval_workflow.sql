/*
# Add Approval Workflow to Receipts

1. Modified Tables
   - `receipts` - adds approval workflow columns:
     - `status` (text, not null, default 'pending') - one of: pending, approved, archived
     - `approved_by` (uuid, nullable) - the user who approved the receipt
     - `approved_at` (timestamptz, nullable) - when the receipt was approved
     - `approval_notes` (text, nullable) - optional notes from the approver

2. Security Changes
   - Updated SELECT policy: mechanics can only see their OWN receipts; staff and master can see ALL receipts in their company
   - Updated UPDATE policy: staff and master can update any receipt (for approvals)
   - Staff can also delete receipts (not just master)

3. Important Notes
   - Existing receipts default to 'pending' status
   - Only staff/master can approve (change status to 'approved' or 'archived')
   - Mechanics see only their own uploaded receipts
*/

-- Add approval columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'status') THEN
    ALTER TABLE receipts ADD COLUMN status text NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'approved_by') THEN
    ALTER TABLE receipts ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'approved_at') THEN
    ALTER TABLE receipts ADD COLUMN approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'approval_notes') THEN
    ALTER TABLE receipts ADD COLUMN approval_notes text;
  END IF;
END $$;

-- Add check constraint for status values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipts_status_check') THEN
    ALTER TABLE receipts ADD CONSTRAINT receipts_status_check CHECK (status IN ('pending', 'approved', 'archived'));
  END IF;
END $$;

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);

-- Updated SELECT policy: mechanics see only their own; staff/master see all
DROP POLICY IF EXISTS "staff_mechanic_master_select_receipts" ON receipts;

DROP POLICY IF EXISTS "mechanic_select_own_receipts" ON receipts;
CREATE POLICY "mechanic_select_own_receipts" ON receipts FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role = 'mechanic'
  )
);

DROP POLICY IF EXISTS "staff_master_select_all_receipts" ON receipts;
CREATE POLICY "staff_master_select_all_receipts" ON receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'master')
  )
  AND (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
);

-- Updated UPDATE policy: staff and master can update (for approvals)
DROP POLICY IF EXISTS "master_update_receipts" ON receipts;
DROP POLICY IF EXISTS "staff_master_update_receipts" ON receipts;
CREATE POLICY "staff_master_update_receipts" ON receipts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'master')
  )
  AND (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'master')
  )
);

-- Updated DELETE: staff can also delete (not just master)
DROP POLICY IF EXISTS "staff_mechanic_delete_own_receipts" ON receipts;
DROP POLICY IF EXISTS "master_delete_any_receipts" ON receipts;

DROP POLICY IF EXISTS "employee_delete_own_pending_receipts" ON receipts;
CREATE POLICY "employee_delete_own_pending_receipts" ON receipts FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'mechanic', 'master')
  )
);

DROP POLICY IF EXISTS "staff_master_delete_any_receipts" ON receipts;
CREATE POLICY "staff_master_delete_any_receipts" ON receipts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'master')
  )
  AND (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
);
