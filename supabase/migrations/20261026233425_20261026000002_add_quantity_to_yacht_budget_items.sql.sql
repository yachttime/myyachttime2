/*
# Add quantity column to yacht_budget_items

1. Changes
  - Adds `quantity` integer column to `yacht_budget_items` (default 1).
  - This allows a package to be included multiple times in a budget
    (e.g., 200-hour oil change performed 3 times per year).

2. Security
  - No RLS or policy changes needed — existing policies already cover
    SELECT/INSERT/UPDATE/DELETE on this table.
*/

ALTER TABLE yacht_budget_items ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
