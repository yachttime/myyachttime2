/*
  # Add Archive Support to Repair Requests

  1. Changes
    - Add `archived` boolean column to `repair_requests` table
    - Defaults to false (not archived)
    - Add index for filtering archived/active requests
    
  2. Purpose
    - Allow users to archive completed, paid, or denied repair requests
    - Keeps the main repair request list clean and focused
    - Archived requests remain accessible in a separate tab
*/

-- Add archived column
ALTER TABLE repair_requests 
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_repair_requests_archived 
ON repair_requests(archived);

-- Add index for common query pattern (archived + yacht_id)
CREATE INDEX IF NOT EXISTS idx_repair_requests_archived_yacht 
ON repair_requests(archived, yacht_id);