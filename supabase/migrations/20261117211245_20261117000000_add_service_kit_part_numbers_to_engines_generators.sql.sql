/*
# Add 100 Hour and 300 Hour Service Kit Part Numbers

1. Plain-English explanation
   Outboard engines have a 100 hour service kit and a 300 hour service kit.
   This adds a place to store each kit's part number alongside the other
   service parts (oil filter, fuel filter, etc.) on engines and generators,
   plus a checkbox to include each kit when building a full service or
   adding service parts to a task.

2. Modified tables (same four new columns each)
   - engine_catalog
   - yacht_engines
   - yacht_generators
   - customer_vessel_engines
   - customer_vessel_generators
   New columns on each:
   - kit100_part_number (text) — part number of the 100 hour service kit
   - kit300_part_number (text) — part number of the 300 hour service kit
   - include_kit100 (boolean, default false) — include the 100 hour kit in service part flows
   - include_kit300 (boolean, default false) — include the 300 hour kit in service part flows

3. Security
   - No RLS changes. Existing table policies and grants continue to apply to
     the new columns automatically.

4. Notes
   - Idempotent: each column is only added if it does not already exist.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_catalog' AND column_name = 'kit100_part_number') THEN
    ALTER TABLE public.engine_catalog ADD COLUMN kit100_part_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_catalog' AND column_name = 'kit300_part_number') THEN
    ALTER TABLE public.engine_catalog ADD COLUMN kit300_part_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_catalog' AND column_name = 'include_kit100') THEN
    ALTER TABLE public.engine_catalog ADD COLUMN include_kit100 boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_catalog' AND column_name = 'include_kit300') THEN
    ALTER TABLE public.engine_catalog ADD COLUMN include_kit300 boolean NOT NULL DEFAULT false;
  END IF;

  ALTER TABLE public.yacht_engines ADD COLUMN IF NOT EXISTS kit100_part_number text;
  ALTER TABLE public.yacht_engines ADD COLUMN IF NOT EXISTS kit300_part_number text;
  ALTER TABLE public.yacht_engines ADD COLUMN IF NOT EXISTS include_kit100 boolean NOT NULL DEFAULT false;
  ALTER TABLE public.yacht_engines ADD COLUMN IF NOT EXISTS include_kit300 boolean NOT NULL DEFAULT false;

  ALTER TABLE public.yacht_generators ADD COLUMN IF NOT EXISTS kit100_part_number text;
  ALTER TABLE public.yacht_generators ADD COLUMN IF NOT EXISTS kit300_part_number text;
  ALTER TABLE public.yacht_generators ADD COLUMN IF NOT EXISTS include_kit100 boolean NOT NULL DEFAULT false;
  ALTER TABLE public.yacht_generators ADD COLUMN IF NOT EXISTS include_kit300 boolean NOT NULL DEFAULT false;

  ALTER TABLE public.customer_vessel_engines ADD COLUMN IF NOT EXISTS kit100_part_number text;
  ALTER TABLE public.customer_vessel_engines ADD COLUMN IF NOT EXISTS kit300_part_number text;
  ALTER TABLE public.customer_vessel_engines ADD COLUMN IF NOT EXISTS include_kit100 boolean NOT NULL DEFAULT false;
  ALTER TABLE public.customer_vessel_engines ADD COLUMN IF NOT EXISTS include_kit300 boolean NOT NULL DEFAULT false;

  ALTER TABLE public.customer_vessel_generators ADD COLUMN IF NOT EXISTS kit100_part_number text;
  ALTER TABLE public.customer_vessel_generators ADD COLUMN IF NOT EXISTS kit300_part_number text;
  ALTER TABLE public.customer_vessel_generators ADD COLUMN IF NOT EXISTS include_kit100 boolean NOT NULL DEFAULT false;
  ALTER TABLE public.customer_vessel_generators ADD COLUMN IF NOT EXISTS include_kit300 boolean NOT NULL DEFAULT false;
END $$;
