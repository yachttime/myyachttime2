/*
  # Add Manager Contact Information to Estimates

  1. Changes
    - Add `manager_email` column to estimates table (text)
    - Add `manager_phone` column to estimates table (text)
    - These fields store the repair approval manager's contact information

  2. Purpose
    - Store manager contact information with the estimate for easy reference
    - Display manager contact details on estimate PDFs and printouts
    - Maintain historical record of manager contacts even if they change later
*/

-- Add manager contact fields to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS manager_email text,
ADD COLUMN IF NOT EXISTS manager_phone text;

-- Add helpful comments
COMMENT ON COLUMN estimates.manager_email IS 'Email of manager with repair approval for the yacht';
COMMENT ON COLUMN estimates.manager_phone IS 'Phone number of manager with repair approval for the yacht';
