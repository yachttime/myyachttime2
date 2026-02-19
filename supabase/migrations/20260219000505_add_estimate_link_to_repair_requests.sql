/*
  # Link Estimates to Repair Requests

  ## Summary
  Adds fields to repair_requests to support creating a repair request directly
  from an estimate in the estimating system.

  ## Changes

  ### Modified Tables
  - `repair_requests`
    - `estimate_id` (uuid, nullable) - FK to estimates table; tracks which estimate originated this repair request
    - `estimate_pdf_url` (text, nullable) - Public URL of the estimate PDF stored in Supabase storage
    - `estimate_pdf_name` (text, nullable) - Filename of the stored estimate PDF

  ## New Storage
  - `estimate-pdfs` bucket - stores estimate PDF files attached to repair requests

  ## Notes
  - All new columns are nullable to maintain backwards compatibility
  - No existing data is modified
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'estimate_id'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'estimate_pdf_url'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN estimate_pdf_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_requests' AND column_name = 'estimate_pdf_name'
  ) THEN
    ALTER TABLE repair_requests ADD COLUMN estimate_pdf_name text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-pdfs',
  'estimate-pdfs',
  true,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload estimate pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'estimate-pdfs');

CREATE POLICY "Anyone can view estimate pdfs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'estimate-pdfs');

CREATE POLICY "Authenticated users can update estimate pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'estimate-pdfs');

CREATE POLICY "Authenticated users can delete estimate pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'estimate-pdfs');
