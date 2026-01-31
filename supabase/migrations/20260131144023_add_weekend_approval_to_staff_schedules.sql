/*
  # Add Weekend Approval System to Staff Schedules

  1. Schema Changes
    - Add approval-related columns to `staff_schedules` table:
      - `requires_approval` (boolean, default false) - indicates if weekend schedule needs approval
      - `approval_status` (text, default 'not_required') - values: 'approved', 'denied', 'pending', 'not_required'
      - `approved_by` (uuid, nullable) - foreign key to user_profiles.user_id who approved/denied
      - `approved_at` (timestamptz, nullable) - timestamp of approval/denial
      - `denial_reason` (text, nullable) - reason if denied
    
    - Add unique constraint on (user_id, day_of_week) to prevent duplicate schedules
    
  2. Security
    - Update RLS policies to allow staff and master roles to manage approvals
    - Ensure users can only view their own denied schedules
    
  3. Important Notes
    - Off-season (October 1 - May 24): Weekend work requires approval
    - On-season (May 25 - September 30): Weekend work does not require approval
    - Schedules are never grandfathered - all future weekend work follows current season rules
*/

-- Add approval columns to staff_schedules table
DO $$
BEGIN
  -- Add requires_approval column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_schedules' AND column_name = 'requires_approval'
  ) THEN
    ALTER TABLE staff_schedules ADD COLUMN requires_approval boolean DEFAULT false;
  END IF;

  -- Add approval_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_schedules' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE staff_schedules ADD COLUMN approval_status text DEFAULT 'not_required'
      CHECK (approval_status IN ('approved', 'denied', 'pending', 'not_required'));
  END IF;

  -- Add approved_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_schedules' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE staff_schedules ADD COLUMN approved_by uuid REFERENCES user_profiles(user_id);
  END IF;

  -- Add approved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_schedules' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE staff_schedules ADD COLUMN approved_at timestamptz;
  END IF;

  -- Add denial_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_schedules' AND column_name = 'denial_reason'
  ) THEN
    ALTER TABLE staff_schedules ADD COLUMN denial_reason text;
  END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'staff_schedules_user_id_day_of_week_key'
  ) THEN
    ALTER TABLE staff_schedules 
      ADD CONSTRAINT staff_schedules_user_id_day_of_week_key 
      UNIQUE (user_id, day_of_week);
  END IF;
END $$;

-- Drop existing policies and recreate with approval logic
DROP POLICY IF EXISTS "Staff and mechanics can view schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Master users can view all schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Users can view own schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff, mechanics, and master can insert schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff, mechanics, and master can update schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Staff, mechanics, and master can delete schedules" ON staff_schedules;

-- SELECT policy: Users see own schedules, staff/master see all approved/pending, only owner sees denied
CREATE POLICY "Users can view own schedules"
  ON staff_schedules FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND (
        staff_schedules.approval_status IN ('approved', 'pending', 'not_required')
        OR staff_schedules.user_id = auth.uid()
      )
    )
  );

-- INSERT policy: Staff, mechanics, and master can create schedules
CREATE POLICY "Staff, mechanics, and master can insert schedules"
  ON staff_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- UPDATE policy: Staff and master can update any schedule, others can update own
CREATE POLICY "Staff and master can update schedules"
  ON staff_schedules FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- DELETE policy: Staff, mechanics, and master can delete schedules
CREATE POLICY "Staff, mechanics, and master can delete schedules"
  ON staff_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Create index on approval_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_staff_schedules_approval_status 
  ON staff_schedules(approval_status);

-- Create index on approved_by for efficient joins
CREATE INDEX IF NOT EXISTS idx_staff_schedules_approved_by 
  ON staff_schedules(approved_by);
