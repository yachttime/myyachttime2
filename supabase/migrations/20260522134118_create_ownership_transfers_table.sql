/*
  # Create Ownership Transfers Table

  ## Purpose
  Records the complete audit trail of yacht ownership transfers. When a share
  of a yacht is sold to a new owner, this table captures who transferred from,
  who transferred to, which yacht, when it happened, who performed it, and any
  notes the master admin added.

  ## New Tables
  - `ownership_transfers`
    - `id` (uuid, PK)
    - `yacht_id` (uuid, FK to yachts) — which yacht changed hands
    - `from_user_id` (uuid, FK to user_profiles.user_id) — outgoing owner
    - `to_user_id` (uuid, FK to user_profiles.user_id) — incoming new owner
    - `transferred_at` (timestamptz) — when the transfer was recorded
    - `transferred_by` (uuid, FK to user_profiles.user_id) — master who performed it
    - `notes` (text, nullable) — optional notes about the transfer
    - `company_id` (uuid, FK to companies)

  ## Security
  - RLS enabled — master role can read all transfers for their company
  - Staff and managers have no access (ownership transfers are master-only)
  - Insert is restricted to authenticated users whose profile role is 'master'
*/

CREATE TABLE IF NOT EXISTS ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  transferred_at timestamptz DEFAULT now(),
  transferred_by uuid NOT NULL,
  notes text,
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_yacht_id ON ownership_transfers(yacht_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_from_user ON ownership_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_user ON ownership_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_company ON ownership_transfers(company_id);

ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;

-- Masters can view all transfer history for their company
CREATE POLICY "Masters can view ownership transfers for their company"
  ON ownership_transfers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'master'
        AND user_profiles.company_id = ownership_transfers.company_id
    )
  );

-- Masters can insert transfer records
CREATE POLICY "Masters can insert ownership transfers"
  ON ownership_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'master'
        AND user_profiles.company_id = ownership_transfers.company_id
    )
  );
