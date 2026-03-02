/*
  # Add annual_fee to vessel_management_agreements

  ## Changes
  - Adds `annual_fee` (numeric) column to `vessel_management_agreements`
  - Default value of 8000.00 to match existing hardcoded value

  ## Notes
  - Existing rows will get the default of 8000.00
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_management_agreements' AND column_name = 'annual_fee'
  ) THEN
    ALTER TABLE vessel_management_agreements
    ADD COLUMN annual_fee numeric(10,2) DEFAULT 8000.00;
  END IF;
END $$;
