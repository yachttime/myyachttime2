/*
  # Add Email Delivered Tracking for Deposit Requests

  1. Changes
    - Add `deposit_email_delivered_at` column to track when deposit emails are successfully delivered
    - Add `deposit_email_bounced_at` column to track bounced deposit emails
    - Brings deposit email tracking in line with other email types (estimates, notifications)

  2. Notes
    - This allows proper tracking of the full email lifecycle: sent → delivered → opened → clicked
    - Bounced tracking helps identify failed email deliveries
*/

-- Add deposit email delivery tracking fields
ALTER TABLE repair_requests 
ADD COLUMN IF NOT EXISTS deposit_email_delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS deposit_email_bounced_at timestamptz;
