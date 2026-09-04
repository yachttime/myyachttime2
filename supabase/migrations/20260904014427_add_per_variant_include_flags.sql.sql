/*
# Add per-variant include flags to engine and generator tables

## Purpose
Previously we added a single `include_<category>` boolean per service part category
(e.g. `include_oil_filter`). Now we need per-VARIANT flags so each individual
part number field (primary, alt1, alt2) can be independently checked/unchecked.
When Quick Full Service runs, every checked variant becomes its own line item.

## Changes
Adds `include_<category>_alt1` and `include_<category>_alt2` boolean columns
(default true) to these 4 tables, for the 5 categories that have alternates:

1. yacht_engines
2. yacht_generators
3. customer_vessel_engines
4. customer_vessel_generators

The existing `include_<category>` column continues to represent the PRIMARY
part number's checkbox.

## New columns (10 per table)
- include_oil_filter_alt1, include_oil_filter_alt2
- include_fuel_filter_alt1, include_fuel_filter_alt2
- include_impeller_alt1, include_impeller_alt2
- include_belt1_alt1, include_belt1_alt2
- include_belt2_alt1, include_belt2_alt2

## Security
No RLS or policy changes — these are plain data columns on existing tables.
*/

DO $$
DECLARE
  t text;
  col text;
  cats text[] := ARRAY['oil_filter','fuel_filter','impeller','belt1','belt2'];
  alts text[] := ARRAY['alt1','alt2'];
BEGIN
  FOREACH t IN ARRAY ARRAY['yacht_engines','yacht_generators','customer_vessel_engines','customer_vessel_generators'] LOOP
    FOREACH col IN ARRAY cats LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = t AND column_name = 'include_' || col || '_alt1'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN include_%s_alt1 boolean NOT NULL DEFAULT true', t, col);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = t AND column_name = 'include_' || col || '_alt2'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN include_%s_alt2 boolean NOT NULL DEFAULT true', t, col);
      END IF;
    END LOOP;
  END LOOP;
END $$;
