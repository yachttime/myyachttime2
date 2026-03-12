/*
  # Add payment_link_expires_at to yacht_invoices

  Adds a 30-day expiration tracking field to yacht_invoices to match
  the same pattern used by other payment link tables.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'payment_link_expires_at'
  ) THEN
    ALTER TABLE yacht_invoices ADD COLUMN payment_link_expires_at timestamptz;
  END IF;
END $$;
