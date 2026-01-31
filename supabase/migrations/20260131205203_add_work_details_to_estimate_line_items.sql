/*
  # Add Work Details to Estimate Line Items

  1. Changes
    - Add `work_details` column to `estimate_line_items` table
      - This allows detailed notes about what work was performed for each line item
      - Especially useful for labor items to document specific tasks completed
      - Optional field (nullable)
*/

-- Add work_details column to estimate_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'work_details'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN work_details text;
  END IF;
END $$;
