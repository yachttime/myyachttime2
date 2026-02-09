/*
  # Update All Pending Deposit Links to 30-Day Expiration

  1. Changes
    - Update ALL repair requests with pending deposit links (including existing ones)
    - Set expiration to 30 days from when the deposit was requested
    - If no request date exists, set expiration to 30 days from now

  2. Purpose
    - Replace old 24-hour expirations with new 30-day policy
    - Give all customers adequate time to pay deposits

  3. Notes
    - Updates all pending deposits regardless of current expiration
    - Extends time for customers who received links recently
*/

-- Update ALL pending deposits to 30-day expiration
UPDATE repair_requests
SET 
  deposit_link_expires_at = CASE
    -- If we know when it was requested, set expiration to 30 days from that date
    WHEN deposit_requested_at IS NOT NULL 
      THEN deposit_requested_at + INTERVAL '30 days'
    -- Otherwise set to 30 days from now
    ELSE NOW() + INTERVAL '30 days'
  END,
  updated_at = NOW()
WHERE 
  deposit_payment_status = 'pending'
  AND deposit_payment_link_url IS NOT NULL;