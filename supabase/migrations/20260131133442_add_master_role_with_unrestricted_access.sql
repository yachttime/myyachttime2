/*
  # Add Master Role with Unrestricted Access

  ## Overview
  Creates a new "master" role for the site designer with complete unrestricted access to all features and data.
  Only users with the master role can assign the master role to other users.

  ## Changes
  
  1. **Enum Type Update**
     - Added 'master' to user_role enum type
  
  2. **Helper Functions Updated**
     - `is_staff()` - Now includes 'master' role
     - `user_has_yacht_access()` - Now includes 'master' role with unrestricted yacht access
  
  3. **Policies Re-created**
     - All policies using is_staff() function were automatically updated to include master role

  ## Important Notes
  - Master role is intended for site designer/administrator use only
  - Master role has complete access to all data across all yachts
  - Only master users can assign the master role (enforced in application layer)
  - Use sparingly and only for trusted personnel
*/

-- =====================================================
-- Step 1: Add 'master' to user_role enum
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'master' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'master';
  END IF;
END $$;

-- =====================================================
-- Step 2: Update Helper Functions to Include Master Role
-- =====================================================

-- Drop and recreate is_staff() function to include master (with CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS is_staff() CASCADE;
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'manager', 'mechanic', 'master')
    AND is_active = true
  );
END;
$$;

-- Drop and recreate is_staff(uuid) function to include master (with CASCADE)
DROP FUNCTION IF EXISTS is_staff(uuid) CASCADE;
CREATE OR REPLACE FUNCTION is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = user_uuid
    AND role IN ('staff', 'manager', 'mechanic', 'master')
    AND is_active = true
  );
END;
$$;

-- Drop and recreate user_has_yacht_access to include master
DROP FUNCTION IF EXISTS user_has_yacht_access(uuid) CASCADE;
CREATE OR REPLACE FUNCTION user_has_yacht_access(yacht_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_id = auth.uid()
    AND (
      user_profiles.yacht_id = yacht_uuid
      OR role IN ('staff', 'master')
    )
    AND is_active = true
  );
END;
$$;

-- =====================================================
-- Step 3: Re-create policies that were dropped with CASCADE
-- =====================================================

-- Repair Requests
CREATE POLICY "Staff can delete maintenance requests"
  ON repair_requests
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Admin Notifications
CREATE POLICY "Authenticated users can view admin notifications"
  ON admin_notifications
  FOR SELECT
  TO authenticated
  USING (is_staff() OR auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE yacht_id = admin_notifications.yacht_id
    AND is_active = true
  ));

CREATE POLICY "Staff can insert admin notifications"
  ON admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update admin notifications"
  ON admin_notifications
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete admin notifications"
  ON admin_notifications
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Trip Inspections
CREATE POLICY "Staff and managers can insert inspections"
  ON trip_inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can update inspections"
  ON trip_inspections
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete trip inspections"
  ON trip_inspections
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Owner Handoff Inspections
CREATE POLICY "Staff can insert owner handoff inspections"
  ON owner_handoff_inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update owner handoff inspections"
  ON owner_handoff_inspections
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete owner handoff inspections"
  ON owner_handoff_inspections
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Yacht Documents
CREATE POLICY "Staff and managers can insert yacht documents"
  ON yacht_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can update yacht documents"
  ON yacht_documents
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can delete yacht documents"
  ON yacht_documents
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Appointments
CREATE POLICY "Staff can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff and managers can view all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can update appointments"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete appointments"
  ON appointments
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Staff Messages
CREATE POLICY "Staff and managers can view all staff messages"
  ON staff_messages
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert staff messages"
  ON staff_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update staff messages"
  ON staff_messages
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete staff messages"
  ON staff_messages
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Yacht Invoices
CREATE POLICY "Staff can insert invoices"
  ON yacht_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update invoices"
  ON yacht_invoices
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete invoices"
  ON yacht_invoices
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Yacht Budgets
CREATE POLICY "Authenticated users can insert yacht budgets"
  ON yacht_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Authenticated users can update yacht budgets"
  ON yacht_budgets
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete budgets"
  ON yacht_budgets
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- yacht_smart_devices
CREATE POLICY "Staff can insert devices"
  ON yacht_smart_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update devices"
  ON yacht_smart_devices
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "Staff can delete devices"
  ON yacht_smart_devices
  FOR DELETE
  TO authenticated
  USING (is_staff());

-- Video Uploads
CREATE POLICY "Authenticated users can view video uploads"
  ON video_uploads
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert video uploads"
  ON video_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update video upload status"
  ON video_uploads
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- Invoice Engagement Events
CREATE POLICY "Staff can view all engagement events"
  ON invoice_engagement_events
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Staff can insert engagement events"
  ON invoice_engagement_events
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

-- Vessel Management Agreements
CREATE POLICY "Staff can insert vessel agreements"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());
