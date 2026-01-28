/*
  # Create Vessel Management Agreements Table

  1. New Tables
    - `vessel_management_agreements`
      - `id` (uuid, primary key) - Unique identifier for each agreement
      - `yacht_id` (uuid, foreign key) - Reference to the yacht
      - `submitted_by` (uuid, foreign key) - Reference to the user who submitted the agreement
      - `season_year` (integer) - Year of the agreement (e.g., 2025)
      - `season_name` (text) - Name of the season (e.g., "Spring 2025", "Annual 2025")
      - `start_date` (date) - Season start date
      - `end_date` (date) - Season end date
      - `status` (text) - Agreement status: draft, pending_approval, approved, rejected, expired

      -- Owner Information (pre-filled but editable)
      - `owner_name` (text) - Owner full name
      - `owner_email` (text) - Owner email address
      - `owner_phone` (text) - Owner phone number
      - `owner_address` (text) - Owner mailing address

      -- Vessel Information
      - `vessel_name` (text) - Yacht name
      - `vessel_make_model` (text) - Make and model
      - `vessel_year` (integer) - Year built
      - `vessel_length` (text) - Length/size
      - `vessel_hull_number` (text) - Hull identification number

      -- Agreement Terms
      - `management_scope` (text) - Scope of management services
      - `maintenance_plan` (text) - Planned maintenance schedule
      - `usage_restrictions` (text) - Any usage restrictions
      - `financial_terms` (text) - Financial arrangements
      - `insurance_provider` (text) - Insurance company name
      - `insurance_policy_number` (text) - Policy number
      - `insurance_expiration` (date) - Insurance expiration date

      -- Emergency Contacts
      - `emergency_contact_name` (text) - Emergency contact name
      - `emergency_contact_phone` (text) - Emergency contact phone
      - `emergency_contact_relationship` (text) - Relationship to owner

      -- Special Provisions
      - `special_provisions` (text) - Any special provisions or notes
      - `additional_services` (text) - Additional services requested

      -- Approval Information
      - `approved_by` (uuid, foreign key) - Manager who approved the agreement
      - `approved_at` (timestamptz) - When the agreement was approved
      - `rejection_reason` (text) - Reason for rejection if applicable
      - `manager_notes` (text) - Notes from the manager

      -- Document Reference
      - `pdf_document_id` (uuid, foreign key) - Reference to generated PDF in yacht_documents

      -- Timestamps
      - `created_at` (timestamptz) - Agreement creation timestamp
      - `updated_at` (timestamptz) - Agreement update timestamp
      - `submitted_at` (timestamptz) - When agreement was submitted for approval

  2. Security
    - Enable RLS on `vessel_management_agreements` table
    - Owners can insert, view, and update their own draft agreements
    - Owners can view their submitted/approved agreements
    - Staff and managers can view all agreements
    - Staff and managers can approve/reject agreements

  3. Indexes
    - Add index on yacht_id for efficient querying
    - Add index on season_year for filtering by year
    - Add index on status for filtering by status
    - Add index on submitted_by for tracking user submissions
*/

CREATE TABLE IF NOT EXISTS vessel_management_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_year integer NOT NULL,
  season_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'expired')),

  -- Owner Information
  owner_name text NOT NULL,
  owner_email text NOT NULL,
  owner_phone text,
  owner_address text,

  -- Vessel Information
  vessel_name text NOT NULL,
  vessel_make_model text,
  vessel_year integer,
  vessel_length text,
  vessel_hull_number text,

  -- Agreement Terms
  management_scope text DEFAULT '',
  maintenance_plan text DEFAULT '',
  usage_restrictions text DEFAULT '',
  financial_terms text DEFAULT '',
  insurance_provider text DEFAULT '',
  insurance_policy_number text DEFAULT '',
  insurance_expiration date,

  -- Emergency Contacts
  emergency_contact_name text DEFAULT '',
  emergency_contact_phone text DEFAULT '',
  emergency_contact_relationship text DEFAULT '',

  -- Special Provisions
  special_provisions text DEFAULT '',
  additional_services text DEFAULT '',

  -- Approval Information
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  manager_notes text,

  -- Document Reference
  pdf_document_id uuid REFERENCES yacht_documents(id) ON DELETE SET NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  submitted_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_yacht_id ON vessel_management_agreements(yacht_id);
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_season_year ON vessel_management_agreements(season_year);
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_status ON vessel_management_agreements(status);
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_submitted_by ON vessel_management_agreements(submitted_by);
CREATE INDEX IF NOT EXISTS idx_vessel_agreements_created_at ON vessel_management_agreements(created_at DESC);

-- Enable RLS
ALTER TABLE vessel_management_agreements ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can insert their own draft agreements
CREATE POLICY "Owners can insert vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.yacht_id = vessel_management_agreements.yacht_id
      AND user_profiles.role = 'owner'
    )
  );

-- Policy: Users can view agreements for their yacht
CREATE POLICY "Users can view vessel agreements for their yacht"
  ON vessel_management_agreements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND (
        user_profiles.yacht_id = vessel_management_agreements.yacht_id
        OR user_profiles.role IN ('staff', 'manager')
      )
    )
  );

-- Policy: Owners can update their own draft agreements
CREATE POLICY "Owners can update their own draft vessel agreements"
  ON vessel_management_agreements
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- Policy: Staff and managers can update any agreement for approval/rejection
CREATE POLICY "Staff and managers can update vessel agreements"
  ON vessel_management_agreements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

-- Policy: Owners can delete their own draft agreements
CREATE POLICY "Owners can delete their own draft vessel agreements"
  ON vessel_management_agreements
  FOR DELETE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vessel_agreement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vessel_agreement_updated_at
  BEFORE UPDATE ON vessel_management_agreements
  FOR EACH ROW
  EXECUTE FUNCTION update_vessel_agreement_updated_at();
