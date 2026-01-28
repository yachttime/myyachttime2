/*
  # Allow Anonymous Users to View Sign-In Videos

  ## Summary
  Allows non-authenticated (anonymous) users to view education videos with the 
  "SignIn" category so they can appear on the sign-in screen.

  ## Changes Made
  - Adds SELECT policy for anonymous users on education_videos table
  - Restricted to only videos with category = 'SignIn'
  - All other video categories remain protected (require authentication)

  ## Security
  - Anonymous users can ONLY view videos with category = 'SignIn'
  - Anonymous users cannot insert, update, or delete any videos
  - Other video categories remain protected and require authentication
*/

CREATE POLICY "Anonymous users can view SignIn category videos"
  ON education_videos
  FOR SELECT
  TO anon
  USING (category = 'SignIn');
