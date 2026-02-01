/*
  # Fix Duplicate Schedule Overrides

  1. Changes
    - Create a function to clean up any duplicate schedule overrides
    - Keep only the most recent override when duplicates exist
    - Run cleanup to remove any existing duplicates
  
  2. Security
    - No changes to RLS policies

  3. Notes
    - This migration ensures data integrity for the staff_schedule_overrides table
    - The unique constraint (user_id, override_date) should prevent future duplicates
    - This cleanup function can be called manually if needed in the future
*/

-- Create function to clean up duplicate schedule overrides
CREATE OR REPLACE FUNCTION cleanup_duplicate_schedule_overrides()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  duplicate_record RECORD;
  keeper_id uuid;
BEGIN
  -- Find all duplicate combinations of user_id and override_date
  FOR duplicate_record IN
    SELECT user_id, override_date
    FROM staff_schedule_overrides
    GROUP BY user_id, override_date
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recently updated record
    SELECT id INTO keeper_id
    FROM staff_schedule_overrides
    WHERE user_id = duplicate_record.user_id
      AND override_date = duplicate_record.override_date
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1;

    -- Delete all other duplicates
    DELETE FROM staff_schedule_overrides
    WHERE user_id = duplicate_record.user_id
      AND override_date = duplicate_record.override_date
      AND id != keeper_id;

    RAISE NOTICE 'Cleaned up duplicates for user_id: %, override_date: %', 
      duplicate_record.user_id, duplicate_record.override_date;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_duplicate_schedule_overrides() TO authenticated;

-- Run the cleanup function to remove any existing duplicates
SELECT cleanup_duplicate_schedule_overrides();

-- Add a comment to document the function
COMMENT ON FUNCTION cleanup_duplicate_schedule_overrides() IS 
  'Removes duplicate schedule override records, keeping only the most recent one for each user/date combination';
