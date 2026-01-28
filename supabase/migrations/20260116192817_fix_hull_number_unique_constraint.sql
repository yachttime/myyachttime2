/*
  # Fix Hull Number Unique Constraint

  1. Changes
    - Drop the strict unique constraint on hull_number
    - Create a partial unique index that only enforces uniqueness for non-empty hull numbers
    - This allows multiple yachts to have NULL or empty hull_number while preventing duplicates of actual hull numbers

  2. Benefits
    - Staff can create yachts without hull numbers
    - Multiple yachts can have empty or NULL hull numbers
    - Actual hull numbers remain unique (no two yachts can have the same real hull number)
*/

-- Drop the existing unique constraint
ALTER TABLE yachts DROP CONSTRAINT IF EXISTS yachts_hull_number_key;

-- Create a partial unique index that only applies to non-empty hull numbers
CREATE UNIQUE INDEX IF NOT EXISTS yachts_hull_number_unique_idx 
  ON yachts (hull_number) 
  WHERE hull_number IS NOT NULL AND hull_number != '';