
CREATE TABLE repair_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  note_type text CHECK (note_type IN ('general', 'issue_found', 'resolved', 'work_order_needed')),
  is_internal boolean NOT NULL DEFAULT false,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_repair_request_notes_repair_request_id ON repair_request_notes(repair_request_id);
CREATE INDEX idx_repair_request_notes_user_id ON repair_request_notes(user_id);
CREATE INDEX idx_repair_request_notes_company_id ON repair_request_notes(company_id);

ALTER TABLE repair_request_notes ENABLE ROW LEVEL SECURITY;

-- Staff and master can see all notes for their company
CREATE POLICY "staff_master_select_repair_request_notes" ON repair_request_notes FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid())
    AND (
      (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

-- Owners can see non-internal notes on their yacht's repair requests
CREATE POLICY "owner_select_repair_request_notes" ON repair_request_notes FOR SELECT
  TO authenticated
  USING (
    is_internal = false
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'owner'
    AND EXISTS (
      SELECT 1 FROM repair_requests rr
      JOIN yachts y ON y.id = rr.yacht_id
      WHERE rr.id = repair_request_notes.repair_request_id
        AND y.id = (SELECT yacht_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- Owners can see non-internal notes on retail repair requests they submitted
CREATE POLICY "owner_select_own_retail_repair_request_notes" ON repair_request_notes FOR SELECT
  TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM repair_requests rr
      WHERE rr.id = repair_request_notes.repair_request_id
        AND rr.submitted_by = auth.uid()
    )
  );

-- Staff, mechanic, master, manager can insert notes
CREATE POLICY "staff_insert_repair_request_notes" ON repair_request_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('staff', 'mechanic', 'master', 'manager')
  );

-- Users can update their own notes
CREATE POLICY "own_update_repair_request_notes" ON repair_request_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Staff/master/manager can delete notes
CREATE POLICY "staff_delete_repair_request_notes" ON repair_request_notes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('master', 'manager')
  );
