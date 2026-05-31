/*
  # Add Surcharge Manager Email Tracking to Estimating Invoices

  Adds dedicated tracking columns for the "Email Surcharge Manager" feature,
  separate from the payment link email flow.

  ## New Columns on estimating_invoices
  - `surcharge_email_sent_at` - timestamp when surcharge manager email was sent
  - `surcharge_email_recipient` - the surcharge manager email address
  - `surcharge_email_delivered_at` - delivery confirmation from Resend webhook
  - `surcharge_email_opened_at` - open tracking from Resend webhook
  - `surcharge_email_clicked_at` - click tracking from Resend webhook
  - `surcharge_email_bounced_at` - bounce tracking from Resend webhook
  - `surcharge_email_resend_id` - Resend email ID for webhook correlation
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_sent_at') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_recipient') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_recipient text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_delivered_at') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_delivered_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_opened_at') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_opened_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_clicked_at') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_clicked_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_bounced_at') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_bounced_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimating_invoices' AND column_name = 'surcharge_email_resend_id') THEN
    ALTER TABLE estimating_invoices ADD COLUMN surcharge_email_resend_id text;
  END IF;
END $$;
