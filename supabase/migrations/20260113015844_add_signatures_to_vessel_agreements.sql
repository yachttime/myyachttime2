/*
  # Add Signature Fields to Vessel Management Agreements

  1. Schema Changes
    - Add signature fields to `vessel_management_agreements`
      - `owner_signature_name` (text) - Name of person signing for the owner
      - `owner_signature_date` (timestamptz) - When the owner signed
      - `owner_signature_ip` (text) - IP address of the signer for audit trail
      - `staff_signature_name` (text) - Name of staff member signing
      - `staff_signature_date` (timestamptz) - When staff signed
      - `staff_signature_ip` (text) - IP address of the staff signer

  2. Notes
    - These fields support online contract signing
    - Both owner and staff signatures are required for a fully executed agreement
    - IP addresses are stored for legal/audit purposes
    - Dates are stored with timezone information
*/

-- Add owner signature fields
ALTER TABLE vessel_management_agreements
  ADD COLUMN IF NOT EXISTS owner_signature_name text,
  ADD COLUMN IF NOT EXISTS owner_signature_date timestamptz,
  ADD COLUMN IF NOT EXISTS owner_signature_ip text;

-- Add staff signature fields
ALTER TABLE vessel_management_agreements
  ADD COLUMN IF NOT EXISTS staff_signature_name text,
  ADD COLUMN IF NOT EXISTS staff_signature_date timestamptz,
  ADD COLUMN IF NOT EXISTS staff_signature_ip text;
