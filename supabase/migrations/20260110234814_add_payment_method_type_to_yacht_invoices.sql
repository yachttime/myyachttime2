/*
  # Add payment method type to yacht invoices

  1. Changes
    - Add `payment_method_type` column to `yacht_invoices` table
      - Values: 'card', 'ach', or 'both'
      - Defaults to 'card' for backward compatibility
    
  2. Notes
    - This allows yacht managers to specify whether owners can pay via:
      - Credit/debit card only
      - ACH (bank transfer) only
      - Both payment methods
*/

-- Add payment method type column
ALTER TABLE yacht_invoices 
ADD COLUMN IF NOT EXISTS payment_method_type text DEFAULT 'card' CHECK (payment_method_type IN ('card', 'ach', 'both'));