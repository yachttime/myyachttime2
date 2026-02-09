/*
  # Update Existing Deposit Links to 30-Day Expiration

  1. Changes
    - Update all existing repair requests with pending deposit links
    - Set expiration to 30 days from when the deposit was requested
    - If no request date exists, set expiration to 30 days from now

  2. Purpose
    - Apply new 30-day expiration policy to existing deposit links
    - Give customers with old links adequate time to pay

  3. Notes
    - Only updates repair requests with pending deposit payments
    - Preserves the original request timestamp when available
*/

-- Update existing pending deposits to 30-day expiration
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
  AND deposit_payment_link_url IS NOT NULL
  AND deposit_link_expires_at IS NULL;