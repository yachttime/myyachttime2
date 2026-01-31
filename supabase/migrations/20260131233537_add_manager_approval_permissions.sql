/*
  # Add Manager Approval Permissions

  1. Changes
    - Add `can_approve_repairs` boolean field to user_profiles table
    - Add `can_approve_billing` boolean field to user_profiles table
    - Both fields default to false
    - These fields indicate which managers have permission to approve repairs and billing/accounting

  2. Purpose
    - Track which managers can approve repair requests
    - Track which managers can approve invoices and billing
    - Allows better delegation of responsibilities among managers
*/

-- Add approval permission fields to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS can_approve_repairs boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_approve_billing boolean DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN user_profiles.can_approve_repairs IS 'Indicates if this manager can approve repair requests';
COMMENT ON COLUMN user_profiles.can_approve_billing IS 'Indicates if this manager can approve invoices and billing';