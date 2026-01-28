/*
  # Create video_uploads table for chunk-based video storage

  1. New Tables
    - `video_uploads`
      - `id` (uuid, primary key) - Unique identifier for the video
      - `yacht_id` (uuid, foreign key) - Reference to yachts table
      - `filename` (text) - Original filename
      - `content_type` (text) - MIME type of the video
      - `total_chunks` (integer) - Number of chunks
      - `total_size_bytes` (bigint) - Total size in bytes
      - `storage_folder` (text) - Path to folder containing chunks in temp-chunks bucket
      - `status` (text) - Upload status: 'uploading', 'complete', 'failed'
      - `created_at` (timestamptz) - Timestamp when upload started
      - `completed_at` (timestamptz) - Timestamp when upload finished

  2. Security
    - Enable RLS on `video_uploads` table
    - Add policy for staff to insert video records
    - Add policy for authenticated users to view videos for their yacht
    - Add policy for staff to view all videos
*/

CREATE TABLE IF NOT EXISTS video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL DEFAULT 'video/mp4',
  total_chunks integer NOT NULL,
  total_size_bytes bigint NOT NULL DEFAULT 0,
  storage_folder text NOT NULL,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'complete', 'failed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert video uploads"
  ON video_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

CREATE POLICY "Staff can view all video uploads"
  ON video_uploads
  FOR SELECT
  TO authenticated
  USING (is_staff());

CREATE POLICY "Users can view videos for their yacht"
  ON video_uploads
  FOR SELECT
  TO authenticated
  USING (user_has_yacht_access(yacht_id));

CREATE POLICY "Staff can update video upload status"
  ON video_uploads
  FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- Create index for faster yacht-based queries
CREATE INDEX IF NOT EXISTS idx_video_uploads_yacht_id ON video_uploads(yacht_id);
CREATE INDEX IF NOT EXISTS idx_video_uploads_status ON video_uploads(status);
