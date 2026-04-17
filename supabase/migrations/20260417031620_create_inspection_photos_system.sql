/*
  # Create Inspection Photos System

  ## Summary
  Adds photo attachment capability to the Trip Inspection form so staff can 
  upload propeller photos and damage photos synced from their GoPro cameras.

  ## New Tables
  - `inspection_photos`
    - `id` (uuid, primary key)
    - `inspection_id` (uuid, foreign key to trip_inspections)
    - `photo_url` (text) - Public URL in Supabase Storage
    - `caption` (text, nullable) - Optional label/description
    - `category` (text) - Category: 'port_prop', 'starboard_prop', 'damage', 'general'
    - `company_id` (uuid, foreign key to companies)
    - `created_by` (uuid, foreign key to auth.users)
    - `created_at` (timestamptz)

  ## New Storage Bucket
  - `inspection-photos` (public) for storing uploaded inspection images

  ## Security
  - RLS enabled on inspection_photos table
  - Staff/mechanic/master can insert photos
  - Staff/mechanic/master/manager can view photos
  - Only creator or master can delete photos
*/

-- Create inspection_photos table
CREATE TABLE IF NOT EXISTS inspection_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES trip_inspections(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text DEFAULT '',
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('port_prop', 'starboard_prop', 'damage', 'general')),
  company_id uuid REFERENCES companies(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

-- Index for fast lookup by inspection
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id ON inspection_photos(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_company_id ON inspection_photos(company_id);

-- Staff/mechanic/master/manager can view photos for their company
CREATE POLICY "Staff and masters can view inspection photos"
  ON inspection_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
      AND (up.company_id = inspection_photos.company_id OR up.role = 'master')
    )
  );

-- Staff/mechanic/master can insert photos
CREATE POLICY "Staff and masters can insert inspection photos"
  ON inspection_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('staff', 'mechanic', 'master', 'manager')
    )
    AND created_by = auth.uid()
  );

-- Masters and the creator can delete photos
CREATE POLICY "Masters and creators can delete inspection photos"
  ON inspection_photos FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'master'
    )
  );

-- Create the inspection-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-photos',
  'inspection-photos',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload inspection photos
CREATE POLICY "Authenticated users can upload inspection photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

-- Storage RLS: public read access
CREATE POLICY "Public can view inspection photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'inspection-photos');

-- Storage RLS: creator or master can delete inspection photos
CREATE POLICY "Creators and masters can delete inspection photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.user_id = auth.uid()
        AND up.role = 'master'
      )
    )
  );
