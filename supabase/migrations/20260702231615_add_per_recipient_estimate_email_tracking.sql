ALTER TABLE repair_requests
  ADD COLUMN IF NOT EXISTS resend_email_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimate_recipient_engagement jsonb DEFAULT '{}';

-- Backfill existing single IDs into the new array
UPDATE repair_requests
SET resend_email_ids = ARRAY[resend_email_id]
WHERE resend_email_id IS NOT NULL
  AND (resend_email_ids IS NULL OR array_length(resend_email_ids, 1) IS NULL OR array_length(resend_email_ids, 1) = 0);
