/*
  # Update Vessel Management Agreements to Manager-Based System

  1. Schema Changes
    - Rename owner fields to manager fields
      - `owner_name` → `manager_name`
      - `owner_email` → `manager_email`
      - `owner_phone` → `manager_phone`
      - `owner_address` → `manager_address`

    - Add new contract-specific fields
      - `estimated_trips` (integer) - Number of estimated trips for the season
      - `per_trip_fee` (numeric) - Fee per trip inspection ($350.00)
      - `total_trip_cost` (numeric) - Total cost for all trips
      - `grand_total` (numeric) - Grand total including annual fee
      - `contract_date` (date) - Date the contract is entered
      - `boatco_initial` (text) - Initial from Boatco representative
      - `manager_repair_approval_name` (text) - Name of person for repair approval
      - `manager_repair_approval_email` (text) - Email for repair approval
      - `manager_repair_approval_phone` (text) - Phone for repair approval
      - `manager_billing_approval_name` (text) - Name of person for billing approval
      - `manager_billing_approval_email` (text) - Email for billing approval
      - `manager_billing_approval_phone` (text) - Phone for billing approval
      - `boat_wifi_name` (text) - Boat WiFi network name
      - `boat_wifi_password` (text) - Boat WiFi password

  2. Notes
    - This changes the system from tracking owner information to manager information
    - The manager represents AZ Marine staff who will manage the vessel
    - Adds fields for the full 2026 Vessel Management Agreement contract
*/

-- Rename owner columns to manager columns
ALTER TABLE vessel_management_agreements
  RENAME COLUMN owner_name TO manager_name;

ALTER TABLE vessel_management_agreements
  RENAME COLUMN owner_email TO manager_email;

ALTER TABLE vessel_management_agreements
  RENAME COLUMN owner_phone TO manager_phone;

ALTER TABLE vessel_management_agreements
  RENAME COLUMN owner_address TO manager_address;

-- Add new contract fields
ALTER TABLE vessel_management_agreements
  ADD COLUMN IF NOT EXISTS estimated_trips integer,
  ADD COLUMN IF NOT EXISTS per_trip_fee numeric(10,2) DEFAULT 350.00,
  ADD COLUMN IF NOT EXISTS total_trip_cost numeric(10,2),
  ADD COLUMN IF NOT EXISTS grand_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS contract_date date,
  ADD COLUMN IF NOT EXISTS boatco_initial text,
  ADD COLUMN IF NOT EXISTS manager_repair_approval_name text,
  ADD COLUMN IF NOT EXISTS manager_repair_approval_email text,
  ADD COLUMN IF NOT EXISTS manager_repair_approval_phone text,
  ADD COLUMN IF NOT EXISTS manager_billing_approval_name text,
  ADD COLUMN IF NOT EXISTS manager_billing_approval_email text,
  ADD COLUMN IF NOT EXISTS manager_billing_approval_phone text,
  ADD COLUMN IF NOT EXISTS boat_wifi_name text,
  ADD COLUMN IF NOT EXISTS boat_wifi_password text;
