/*
# Add Annual Management Fee, Season Trip Fees, and Off-Season Trip Fees to yacht_budgets

## Purpose
The Budget Builder wizard needs three new fee input fields that get saved
directly to the yacht_budgets header table:
- Annual Management Fee
- Season Trip Fees
- Off-Season Trip Fees

These are distinct from the existing `management_fees` and `trip_inspection_fees`
columns (which are used in the Dashboard's manual budget breakdown editor).

## Changes
1. New columns on `yacht_budgets`:
   - `annual_management_fee` numeric(10,2) NOT NULL DEFAULT 0
   - `season_trip_fees` numeric(10,2) NOT NULL DEFAULT 0
   - `off_season_trip_fees` numeric(10,2) NOT NULL DEFAULT 0

2. Security: No policy changes needed — the table already has RLS enabled
   with appropriate policies for authenticated users. The new columns
   inherit the existing table-level access controls.
*/

ALTER TABLE yacht_budgets
  ADD COLUMN IF NOT EXISTS annual_management_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_trip_fees numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS off_season_trip_fees numeric(10,2) NOT NULL DEFAULT 0;