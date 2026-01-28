/*
  # Update Vessel Management Agreements - Trip Fields and Consent

  1. Schema Changes
    - Replace `estimated_trips` with separate season and off-season trip fields
      - `season_trips` (integer) - Number of trips during the season
      - `off_season_trips` (integer) - Number of trips during off-season
    - Add consent fields
      - `consent_office_scheduling` (boolean) - Consent to schedule through office only
      - `consent_payment_terms` (boolean) - Consent to 48-hour payment terms

  2. Data Migration
    - Copy existing `estimated_trips` values to `season_trips`
    - Set `off_season_trips` to 0 for existing records
    - Set consent fields to false for existing records

  3. Notes
    - Both trip types are charged at $350 per trip
    - Total trips = season_trips + off_season_trips
    - Consent fields are required for agreement submission
*/

-- Add new trip columns
ALTER TABLE vessel_management_agreements
  ADD COLUMN IF NOT EXISTS season_trips integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS off_season_trips integer DEFAULT 0;

-- Add consent columns
ALTER TABLE vessel_management_agreements
  ADD COLUMN IF NOT EXISTS consent_office_scheduling boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_payment_terms boolean DEFAULT false;

-- Migrate existing estimated_trips data to season_trips
UPDATE vessel_management_agreements
SET season_trips = COALESCE(estimated_trips, 0)
WHERE estimated_trips IS NOT NULL;

-- Drop the old estimated_trips column
ALTER TABLE vessel_management_agreements
  DROP COLUMN IF EXISTS estimated_trips;