/*
  # Create Yacht Documents Table

  1. New Tables
    - `yacht_documents`
      - `id` (uuid, primary key) - Unique identifier for each document
      - `yacht_id` (uuid, foreign key) - Reference to the yacht
      - `document_name` (text) - Name/title of the document
      - `file_url` (text) - URL to the stored document file
      - `file_type` (text) - MIME type of the file (e.g., 'application/pdf', 'image/jpeg')
      - `file_size` (bigint) - File size in bytes
      - `uploaded_by` (uuid, foreign key) - Reference to the user who uploaded the document
      - `uploaded_by_name` (text) - Denormalized name for display
      - `notes` (text) - Optional notes about the document
      - `created_at` (timestamptz) - Document creation timestamp
      - `updated_at` (timestamptz) - Document update timestamp

  2. Security
    - Enable RLS on `yacht_documents` table
    - Add policy for staff/managers to insert documents
    - Add policy for authenticated users to view documents
    - Add policy for staff/managers to delete documents

  3. Indexes
    - Add index on yacht_id for efficient querying
    - Add index on uploaded_by for tracking uploads
    - Add index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS yacht_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yacht_documents_yacht_id ON yacht_documents(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_documents_uploaded_by ON yacht_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_yacht_documents_created_at ON yacht_documents(created_at DESC);

ALTER TABLE yacht_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view yacht documents"
  ON yacht_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and managers can insert yacht documents"
  ON yacht_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

CREATE POLICY "Staff and managers can delete yacht documents"
  ON yacht_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );

CREATE POLICY "Staff and managers can update yacht documents"
  ON yacht_documents
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
