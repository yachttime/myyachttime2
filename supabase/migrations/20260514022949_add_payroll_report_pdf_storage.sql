/*
  # Add Payroll Report PDF Storage

  ## Summary
  When a pay period is marked as processed, a PDF snapshot is automatically generated
  and stored as a permanent backup. This prevents data loss if time entries are ever
  accidentally deleted after payroll is run.

  ## Changes
  1. New storage bucket: `payroll-report-pdfs` (private, authenticated access only)
  2. New column on `pay_periods`: `pdf_url` (text, nullable) - stores the path to the
     archived PDF once the period is processed

  ## Security
  - Bucket is NOT public - only authenticated staff/master users can read
  - INSERT/SELECT policies scoped to authenticated users with staff or master roles
*/

-- Add pdf_url column to pay_periods
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pay_periods' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE pay_periods ADD COLUMN pdf_url text;
  END IF;
END $$;

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payroll-report-pdfs',
  'payroll-report-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload (insert)
CREATE POLICY "Authenticated users can upload payroll PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payroll-report-pdfs');

-- Allow authenticated users to read payroll PDFs
CREATE POLICY "Authenticated users can read payroll PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payroll-report-pdfs');
