/*
  # Add Notes Columns to Work Orders

  1. Changes
    - Add `notes` column for internal notes (staff/mechanic use)
    - Add `customer_notes` column for customer-facing terms & conditions
    
  2. Purpose
    - `notes` - Internal notes visible only to staff
    - `customer_notes` - Terms, conditions, or special instructions for customers
*/

-- Add notes columns to work_orders table
DO $$
BEGIN
  -- Add notes if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN notes text;
  END IF;

  -- Add customer_notes if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'customer_notes'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN customer_notes text;
  END IF;
END $$;
