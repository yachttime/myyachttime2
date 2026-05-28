/*
  Add index on education_videos for sign-in query performance.

  The sign-in page queries education_videos by category + yacht_id on every load.
  Without an index this is a full table scan that under concurrent load contributes
  to connection pool exhaustion and 504s.
*/

CREATE INDEX IF NOT EXISTS idx_education_videos_category_yacht_id
  ON education_videos (category, yacht_id, order_index);
