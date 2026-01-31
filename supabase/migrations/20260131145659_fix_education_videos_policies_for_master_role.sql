/*
  # Fix Education Videos Policies for Master Role

  ## Summary
  Re-creates missing INSERT, UPDATE, and DELETE policies for education_videos that were 
  accidentally dropped when the master role was added. The master role should have full 
  access to manage all education videos.

  ## Changes Made
  1. **DROP existing policies** (if any remain)
     - Ensures clean slate for policy recreation
  
  2. **SELECT Policy**
     - Keeps existing policy that allows all authenticated users to view all videos
  
  3. **INSERT/UPDATE/DELETE Policies**
     - Recreates policies using is_staff() function which now includes master role
     - Master, staff, manager, and mechanic roles can manage all videos
  
  ## Security
  - All authenticated users can view ALL education videos (no yacht restrictions)
  - Only staff roles (staff, manager, mechanic, master) can insert, update, or delete videos
  - Master role has unrestricted access to all education video management functions
*/

-- =====================================================
-- Drop existing policies to ensure clean state
-- =====================================================

DROP POLICY IF EXISTS "Only staff can insert education videos" ON education_videos;
DROP POLICY IF EXISTS "Only staff can update education videos" ON education_videos;
DROP POLICY IF EXISTS "Only staff can delete education videos" ON education_videos;

-- =====================================================
-- Recreate INSERT/UPDATE/DELETE policies with is_staff()
-- =====================================================

-- INSERT: Only staff (including master) can add new videos
CREATE POLICY "Only staff can insert education videos"
  ON education_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

-- UPDATE: Only staff (including master) can update videos
CREATE POLICY "Only staff can update education videos"
  ON education_videos
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- DELETE: Only staff (including master) can delete videos
CREATE POLICY "Only staff can delete education videos"
  ON education_videos
  FOR DELETE
  TO authenticated
  USING (is_staff());
