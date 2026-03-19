/*
  # Add vessel_management_agreement_id to yacht_invoices

  ## Summary
  Links yacht invoices to their originating vessel management agreement so the
  invoice email can display the financial terms from the agreement.

  ## Changes
  - `yacht_invoices` table
    - New column: `vessel_management_agreement_id` (uuid, nullable FK to vessel_management_agreements)

  ## Notes
  - Column is nullable so existing invoices created from repair requests are unaffected.
  - The FK references vessel_management_agreements(id) with ON DELETE SET NULL.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yacht_invoices' AND column_name = 'vessel_management_agreement_id'
  ) THEN
    ALTER TABLE yacht_invoices
      ADD COLUMN vessel_management_agreement_id uuid
      REFERENCES vessel_management_agreements(id) ON DELETE SET NULL;
  END IF;
END $$;
