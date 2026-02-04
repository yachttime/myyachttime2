/*
  # Add Manager Notification Email Tracking

  1. Changes
    - Add `notification_email_sent_at` - timestamp when notification email to managers was sent
    - Add `notification_resend_email_id` - Resend email ID for the notification email
    - Add `notification_email_delivered_at` - timestamp when notification was delivered
    - Add `notification_email_opened_at` - timestamp when notification was opened
    - Add `notification_email_clicked_at` - timestamp when links in notification were clicked
    - Add `notification_email_bounced_at` - timestamp if notification bounced
    
  2. Purpose
    - Separate tracking for manager notification emails vs customer estimate emails
    - Manager notifications use `notification_*` fields
    - Customer estimate emails use `estimate_*` fields
    
  3. Notes
    - This allows proper tracking of both types of emails independently
    - The webhook handler will need to be updated to handle both email types
*/

-- Add notification email tracking columns
ALTER TABLE repair_requests
ADD COLUMN IF NOT EXISTS notification_email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS notification_resend_email_id text,
ADD COLUMN IF NOT EXISTS notification_email_delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS notification_email_opened_at timestamptz,
ADD COLUMN IF NOT EXISTS notification_email_clicked_at timestamptz,
ADD COLUMN IF NOT EXISTS notification_email_bounced_at timestamptz;
