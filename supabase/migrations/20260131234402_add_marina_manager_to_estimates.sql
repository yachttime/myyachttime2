/*
  # Add Marina and Manager Fields to Estimates

  1. Changes
    - Add `marina_name` column to estimates table (text)
    - Add `manager_name` column to estimates table (text)
    - These fields store the yacht's marina location and the repair approval manager name

  2. Purpose
    - Pre-populate marina information from yacht when estimate is created
    - Track which manager (with repair approval) is responsible for the estimate
    - Provides better context on estimates and work orders
*/

-- Add marina and manager fields to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS marina_name text,
ADD COLUMN IF NOT EXISTS manager_name text;

-- Add helpful comments
COMMENT ON COLUMN estimates.marina_name IS 'Marina name from yacht, populated when estimate is created';
COMMENT ON COLUMN estimates.manager_name IS 'Name of manager with repair approval for the yacht';