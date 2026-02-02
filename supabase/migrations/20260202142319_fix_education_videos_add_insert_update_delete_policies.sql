/*
  # Fix Education Videos RLS - Add Insert, Update, Delete Policies

  1. Changes
    - Add INSERT policy for staff and master roles to create education videos
    - Add UPDATE policy for staff and master roles to update education videos
    - Add DELETE policy for staff and master roles to delete education videos

  2. Security
    - Only staff and master roles can manage education videos
    - All authenticated users can view education videos
    - Anonymous users can only view SignIn category videos
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff and Master can insert education videos" ON education_videos;
DROP POLICY IF EXISTS "Staff and Master can update education videos" ON education_videos;
DROP POLICY IF EXISTS "Staff and Master can delete education videos" ON education_videos;

-- Allow staff and master roles to insert education videos
CREATE POLICY "Staff and Master can insert education videos"
  ON education_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Allow staff and master roles to update education videos
CREATE POLICY "Staff and Master can update education videos"
  ON education_videos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );

-- Allow staff and master roles to delete education videos
CREATE POLICY "Staff and Master can delete education videos"
  ON education_videos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'master')
    )
  );
