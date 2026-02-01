/*
  # Fix Work Order Status Values

  1. Changes
    - Update the work_orders status check constraint to include 'waiting_for_parts' and 'in_process'
    - These statuses are used in the frontend dropdown but were missing from the database constraint

  2. Security
    - No changes to RLS policies
*/

-- Drop the existing constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Add the updated constraint with all status values
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check 
  CHECK (status IN ('pending', 'waiting_for_parts', 'in_process', 'completed', 'invoiced'));
