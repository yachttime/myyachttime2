/*
  # Make vessel agreement dates nullable for draft support

  start_date and end_date are currently NOT NULL, which prevents saving
  drafts where the user hasn't filled in dates yet.
  
  Making them nullable allows saving partial drafts.
*/

ALTER TABLE vessel_management_agreements 
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL,
  ALTER COLUMN manager_name DROP NOT NULL,
  ALTER COLUMN manager_email DROP NOT NULL,
  ALTER COLUMN vessel_name DROP NOT NULL,
  ALTER COLUMN season_name DROP NOT NULL,
  ALTER COLUMN season_year DROP NOT NULL;
