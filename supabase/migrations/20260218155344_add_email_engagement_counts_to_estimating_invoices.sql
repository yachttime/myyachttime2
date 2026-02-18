/*
  # Add email engagement count columns to estimating_invoices

  ## Changes
  - Adds `email_open_count` to track how many times the payment email was opened
  - Adds `email_click_count` to track how many times the payment link was clicked

  These match the fields already tracked on the repair request invoice system
  and are used to display engagement badges (e.g. "3x") in the payment section.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'email_open_count'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN email_open_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimating_invoices' AND column_name = 'email_click_count'
  ) THEN
    ALTER TABLE estimating_invoices ADD COLUMN email_click_count integer DEFAULT 0;
  END IF;
END $$;
