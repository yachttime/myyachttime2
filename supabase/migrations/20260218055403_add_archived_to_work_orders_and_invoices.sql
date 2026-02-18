/*
  # Add Archive Support to Work Orders and Estimating Invoices

  1. Changes
    - Add `archived` boolean column to `work_orders` table with default false
    - Add `archived` boolean column to `estimating_invoices` table with default false
    - Create indexes on archived columns for better query performance

  2. Purpose
    - Allow users to archive completed or old work orders and invoices
    - Keep main views clean while preserving historical records
    - Provide ability to restore archived items if needed
*/

-- Add archived column to work_orders
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Add archived column to estimating_invoices
ALTER TABLE estimating_invoices
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_orders_archived ON work_orders(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_archived ON estimating_invoices(archived) WHERE archived = false;
