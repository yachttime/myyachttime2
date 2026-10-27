/*
# Create Estimate Photos System

## Summary
Adds photo attachment capability to the Estimate form so staff can upload
photos that support the charges on an estimate (damage, parts, work needed, etc.).

## New Tables
- `estimate_photos`
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, foreign key to estimates, ON DELETE CASCADE)
  - `photo_url` (text) - Public URL in Supabase Storage
  - `caption` (text, nullable) - Optional label/description
  - `category` (text) - Category: 'damage', 'parts', 'work_needed', 'general'
  - `company_id` (uuid, foreign key to companies)
  - `created_by` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)

## New Storage Bucket
- `estimate-photos` (public, 50 MB limit, image MIME allowlist)

## Security
- RLS enabled on estimate_photos table
- Staff/mechanic/master/manager can view photos within their company
- Staff/mechanic/master/manager can insert photos (must be creator)
- Only creator or master can delete photos
- Storage bucket: authenticated INSERT, public SELECT, owner/master DELETE

## Important Notes
1. Photos can only be added to existing (saved) estimates since an estimate_id is required.
2. The category field uses a CHECK constraint to limit to: damage, parts, work_needed, general.
3. When an estimate is deleted, all its photos are cascade-deleted from the table (storage files remain orphaned but inaccessible).
*/

-- Create estimate_photos table
CREATE TABLE IF NOT EXISTS estimate_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text DEFAULT '',
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('damage', 'parts', 'work_needed', 'general')),
  company_id uuid REFERENCES companies(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE estimate_photos ENABLE ROW LEVEL SECURITY;

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_estimate_photos_estimate_id ON estimate_photos(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_photos_company_id ON estimate_photos(company_id);

-- Staff/mechanic/master/manager can view photos for their company
DROP POLICY IF EXISTS "Staff and masters can view estimate photos" ON estimate_photos;
CREATE POLICY "Staff and masters can view estimate photos"
  ON estimate_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      AND (up.company_id = estimate_photos.company_id OR up.role = 'master')
    )
  );

-- Staff/mechanic/master/manager can insert photos (must be the creator)
DROP POLICY IF EXISTS "Staff and masters can insert estimate photos" ON estimate_photos;
CREATE POLICY "Staff and masters can insert estimate photos"
  ON estimate_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
    )
    AND created_by = auth.uid()
  );

-- Only the creator or a master can delete photos
DROP POLICY IF EXISTS "Masters and creators can delete estimate photos" ON estimate_photos;
CREATE POLICY "Masters and creators can delete estimate photos"
  ON estimate_photos FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'master'
    )
  );

-- Grant access to service_role for edge functions
GRANT SELECT, INSERT, DELETE ON estimate_photos TO authenticated;

-- Create the estimate-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-photos',
  'estimate-photos',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload estimate photos
DROP POLICY IF EXISTS "Authenticated users can upload estimate photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload estimate photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'estimate-photos');

-- Storage RLS: public read access
DROP POLICY IF EXISTS "Public can view estimate photos" ON storage.objects;
CREATE POLICY "Public can view estimate photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'estimate-photos');

-- Storage RLS: creator or master can delete estimate photos
DROP POLICY IF EXISTS "Creators and masters can delete estimate photos" ON storage.objects;
CREATE POLICY "Creators and masters can delete estimate photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'estimate-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.user_id = auth.uid()
        AND up.role = 'master'
      )
    )
  );
