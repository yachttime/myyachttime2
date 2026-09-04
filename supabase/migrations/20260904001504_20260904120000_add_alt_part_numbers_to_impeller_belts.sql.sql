/*
  # Add Alternate Part Numbers for Impeller, Belt 1, and Belt 2

  ## Summary
  Adds two alternate/cross-over part number fields for each of Impeller, Belt 1,
  and Belt 2 on all four engine/generator tables, matching the existing pattern
  used for Oil Filter and Fuel Filter (which already have _alt1 and _alt2 columns).

  ## New Columns (added to yacht_engines, yacht_generators, customer_vessel_engines, customer_vessel_generators)
  - impeller_alt1 (text) - First alternate impeller part number
  - impeller_alt2 (text) - Second alternate impeller part number
  - belt1_alt1 (text) - First alternate belt 1 part number
  - belt1_alt2 (text) - Second alternate belt 1 part number
  - belt2_alt1 (text) - First alternate belt 2 part number
  - belt2_alt2 (text) - Second alternate belt 2 part number

  All columns default to empty string, consistent with the existing service part columns.

  ## Security
  No RLS policy changes needed — existing policies already cover all columns on these tables.
*/

DO $$
DECLARE
  tbl text;
  col text;
  new_cols text[] := ARRAY[
    'impeller_alt1', 'impeller_alt2',
    'belt1_alt1', 'belt1_alt2',
    'belt2_alt1', 'belt2_alt2'
  ];
  tables text[] := ARRAY['yacht_engines', 'yacht_generators', 'customer_vessel_engines', 'customer_vessel_generators'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOREACH col IN ARRAY new_cols LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = tbl AND column_name = col
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I text NOT NULL DEFAULT ''''', tbl, col);
      END IF;
    END LOOP;
  END LOOP;
END $$;