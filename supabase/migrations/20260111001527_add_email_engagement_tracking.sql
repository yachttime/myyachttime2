/*
  # Add Email Engagement Tracking

  1. Changes to yacht_invoices table
    - Add resend_email_id to store Resend's email ID
    - Add payment_email_delivered_at for delivery tracking
    - Add payment_email_opened_at for first open tracking
    - Add payment_link_clicked_at for first click tracking
    - Add payment_email_bounced_at for bounce tracking
    - Add email_open_count for tracking multiple opens
    - Add email_click_count for tracking multiple clicks

  2. New Tables
    - invoice_engagement_events
      - Stores detailed history of all email engagement events
      - Tracks delivered, opened, clicked, bounced, and delivery_delayed events
      - Includes full webhook payload for debugging

  3. Security
    - Enable RLS on invoice_engagement_events
    - Staff can view all engagement events using is_staff() function
*/

-- Add engagement tracking columns to yacht_invoices
ALTER TABLE yacht_invoices
  ADD COLUMN IF NOT EXISTS resend_email_id text,
  ADD COLUMN IF NOT EXISTS payment_email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_link_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_open_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_click_count integer DEFAULT 0;

-- Create index on resend_email_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_yacht_invoices_resend_email_id
  ON yacht_invoices(resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- Create invoice engagement events table
CREATE TABLE IF NOT EXISTS invoice_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES yacht_invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resend_event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_invoice_engagement_events_invoice_id
  ON invoice_engagement_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_engagement_events_event_type
  ON invoice_engagement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_invoice_engagement_events_occurred_at
  ON invoice_engagement_events(occurred_at DESC);

-- Enable RLS
ALTER TABLE invoice_engagement_events ENABLE ROW LEVEL SECURITY;

-- Staff can view all engagement events
CREATE POLICY "Staff can view all engagement events"
  ON invoice_engagement_events FOR SELECT
  TO authenticated
  USING (is_staff());

-- Staff can insert engagement events (for webhook handler)
CREATE POLICY "Staff can insert engagement events"
  ON invoice_engagement_events FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

-- Add helpful comments
COMMENT ON TABLE invoice_engagement_events IS 'Tracks all email engagement events from Resend webhooks for invoice payment emails';
COMMENT ON COLUMN yacht_invoices.resend_email_id IS 'Resend email ID for tracking engagement via webhooks';
COMMENT ON COLUMN yacht_invoices.email_open_count IS 'Number of times the payment email was opened';
COMMENT ON COLUMN yacht_invoices.email_click_count IS 'Number of times links in the payment email were clicked';
