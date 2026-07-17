/*
# Create Receipts Table

1. New Tables
   - `receipts` - stores credit card receipt records uploaded by employees
     - `id` (uuid, primary key)
     - `user_id` (uuid, references auth.users - the employee who uploaded)
     - `receipt_url` (text, not null - storage path to the uploaded image)
     - `amount` (numeric(10,2), not null - receipt total amount)
     - `description` (text, nullable - brief note about the purchase)
     - `tag_type` (text, not null - one of: yacht, customer, shop_supplies, fuel_company_vehicle, fuel_company_boat)
     - `yacht_id` (uuid, nullable - references yachts, when tag_type is yacht)
     - `customer_id` (uuid, nullable - references customers, when tag_type is customer)
     - `estimate_id` (uuid, nullable - references estimates, for linking to a specific estimate)
     - `receipt_date` (date, not null - date of purchase)
     - `company_id` (uuid, nullable - for multi-company isolation)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - RLS enabled
   - Staff, mechanic, and master can SELECT all receipts (company-scoped)
   - Staff, mechanic, and master can INSERT their own receipts
   - Staff and mechanic can DELETE their own; master can DELETE any
   - Master can UPDATE any receipt

3. Important Notes
   - tag_type is constrained via CHECK constraint
   - company_id uses auto-assign trigger pattern from existing codebase
   - Indexes on user_id, company_id, receipt_date, tag_type for performance
*/

CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_url text NOT NULL,
  amount numeric(10,2) NOT NULL,
  description text,
  tag_type text NOT NULL CHECK (tag_type IN ('yacht', 'customer', 'shop_supplies', 'fuel_company_vehicle', 'fuel_company_boat')),
  yacht_id uuid REFERENCES yachts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_company_id ON receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_tag_type ON receipts(tag_type);

-- Enable RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- SELECT: staff, mechanic, master can see all receipts in their company
DROP POLICY IF EXISTS "staff_mechanic_master_select_receipts" ON receipts;
CREATE POLICY "staff_mechanic_master_select_receipts" ON receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'mechanic', 'master')
  )
  AND (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
);

-- INSERT: staff, mechanic, master can insert their own receipts
DROP POLICY IF EXISTS "staff_mechanic_master_insert_receipts" ON receipts;
CREATE POLICY "staff_mechanic_master_insert_receipts" ON receipts FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'mechanic', 'master')
  )
);

-- UPDATE: master can update any receipt in their company
DROP POLICY IF EXISTS "master_update_receipts" ON receipts;
CREATE POLICY "master_update_receipts" ON receipts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role = 'master'
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
    AND role = 'master'
  )
);

-- DELETE: staff/mechanic can delete their own; master can delete any
DROP POLICY IF EXISTS "staff_mechanic_delete_own_receipts" ON receipts;
CREATE POLICY "staff_mechanic_delete_own_receipts" ON receipts FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'mechanic')
  )
);

DROP POLICY IF EXISTS "master_delete_any_receipts" ON receipts;
CREATE POLICY "master_delete_any_receipts" ON receipts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role = 'master'
  )
  AND (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
);

-- Auto-assign company_id trigger (reuses existing pattern)
CREATE OR REPLACE FUNCTION public.auto_assign_receipt_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.user_profiles
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_assign_receipt_company_id ON receipts;
CREATE TRIGGER trigger_auto_assign_receipt_company_id
  BEFORE INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_receipt_company_id();
