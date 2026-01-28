/*
  # Add Arrival and Departure Times to Vessel Management Agreements

  1. Schema Changes
    - Add vessel availability schedule fields to `vessel_management_agreements`
      - `agreed_arrival_time` (time) - Agreed upon arrival time for vessel access
      - `agreed_departure_time` (time) - Agreed upon departure time for vessel access

  2. Notes
    - These times define the agreed schedule for when the vessel is available
    - Times are stored in HH:MM:SS format
    - Fields are optional and can be left null if not specified
*/

-- Add arrival and departure time columns
ALTER TABLE vessel_management_agreements
  ADD COLUMN IF NOT EXISTS agreed_arrival_time time,
  ADD COLUMN IF NOT EXISTS agreed_departure_time time;
