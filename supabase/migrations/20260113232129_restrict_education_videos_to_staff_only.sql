/*
  # Restrict Education Videos to Staff Only

  ## Summary
  Updates the RLS policies for education_videos table to ensure only true staff members
  (staff, manager, mechanic) can edit or delete videos. Owners should only be able to view.

  ## Changes Made
  - Drops existing UPDATE and DELETE policies
  - Creates new UPDATE and DELETE policies with explicit role checks
  - Excludes 'owner' role from editing capabilities

  ## Security
  - Only staff, manager, and mechanic roles can update or delete education videos
  - All authenticated users can still view videos (based on yacht access)
  - Owners can view but cannot edit or delete
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can update education videos" ON education_videos;
DROP POLICY IF EXISTS "Staff can delete education videos" ON education_videos;
DROP POLICY IF EXISTS "Staff can insert education videos" ON education_videos;

-- Create new policies with explicit role checks
CREATE POLICY "Only staff can insert education videos"
  ON education_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Only staff can update education videos"
  ON education_videos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('staff', 'manager', 'mechanic')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('staff', 'manager', 'mechanic')
    )
  );

CREATE POLICY "Only staff can delete education videos"
  ON education_videos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('staff', 'manager', 'mechanic')
    )
  );
