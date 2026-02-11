/*
  # Add Payment Method Type for Deposits

  ## Overview
  This migration adds the ability to specify the payment method type (card, ACH, or both) when requesting deposits on repair requests.

  ## Changes Made

  ### 1. New Column Added to `repair_requests` table
    - `deposit_payment_method_type` (text) - Specifies which payment methods are allowed for deposits
      - Values: 'card', 'ach', or 'both'
      - Defaults to 'card' for backward compatibility

  ## Notes
  - This matches the same functionality available for yacht invoices
  - Allows staff to restrict payment methods based on business requirements
  - Existing deposits will default to 'card' for backward compatibility
*/

-- Add payment method type column for deposits
ALTER TABLE repair_requests
ADD COLUMN IF NOT EXISTS deposit_payment_method_type text DEFAULT 'card' CHECK (deposit_payment_method_type IN ('card', 'ach', 'both'));