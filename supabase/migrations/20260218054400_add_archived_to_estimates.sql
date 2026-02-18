/*
  # Add archived field to estimates

  1. Changes
    - Add `archived` boolean field to `estimates` table with default false
    - Add index on archived field for faster filtering
  
  2. Purpose
    - Allow estimates to be archived instead of deleted
    - Archived estimates can be moved to an archive tab
    - Maintains historical data while keeping active list clean
*/

-- Add archived column to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_estimates_archived ON estimates(archived);

-- Add comment
COMMENT ON COLUMN estimates.archived IS 'Flag to mark estimate as archived instead of deleting';