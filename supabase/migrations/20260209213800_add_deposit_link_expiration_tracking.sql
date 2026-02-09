/*
  # Add Deposit Link Expiration Tracking

  1. Changes
    - Add `deposit_link_expires_at` column to track when the Stripe checkout session expires
    - This allows the UI to detect expired links and show regeneration options

  2. Purpose
    - Track deposit payment link expiration times
    - Enable UI to show when links are expired
    - Allow users to regenerate expired links

  3. Notes
    - Stripe checkout sessions have a maximum expiration time
    - When a link expires, a new one must be generated
*/

-- Add expiration timestamp column
ALTER TABLE repair_requests 
ADD COLUMN IF NOT EXISTS deposit_link_expires_at timestamptz;

-- Add index for querying expired links
CREATE INDEX IF NOT EXISTS idx_repair_requests_deposit_expires 
ON repair_requests(deposit_link_expires_at) 
WHERE deposit_payment_status = 'pending';
